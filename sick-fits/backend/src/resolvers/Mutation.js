const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {randomBytes} = require('crypto');
const{promisify} = require('util');
const {transport, makeANiceEmail} = require('../mail');
const {hasPermission} = require('../utils');
const stripe = require('../stripe');

const Mutations = {
	async createItem(parent, args, ctx, info) {
		// TODO Check if they are logged in - DONE!!
		if (!ctx.request.userId) {
			throw new Error('You must be logged in to create an item');
		}

		// Here we are going to interface with the Prisma database, the API is everything inside prisma.graphq
		const item = await ctx.db.mutation.createItem({
			data: {
				// Spreading the args argument
				// This is how to create relationship between item and user
				user: {
					connect: {
						id: ctx.request.userId
					}
				},
				...args
			}
		}, info);

		return item;
	},
	
	updateItem(parent, args, ctx, info) {
		// Take a copy of the updates
		const updates = { ...args};
		// remove the ID from the updates
		delete updates.id;
		// run the update method
		return ctx.db.mutation.updateItem({
			data: updates,
			where: {
				id: args.id
			}
		}, info
		);
	},

	async deleteItem(parent, args, ctx, info) {
		const where = {id: args.id};
		// first find the item
		const item = await ctx.db.query.item({where}, `{
			id
			title
			user {
				id
			}
		}`);

		// check if they own the item or have the permissions
		const ownsItem = item.user.id === ctx.request.userId;
		const hasPermissions = ctx.request.user.permissions.some(permission => ['ADMIN', 'ITEMDELETE'].includes(permission));

		if (!ownsItem && hasPermissions) {
			throw new Error('You cannot delete items');
		}

		// delete item
		return ctx.db.mutation.deleteItem({where}, info);
	},

	async signup(parent, args, ctx, info) {
		args.email = args.email.toLowerCase();

		// hash password
		const password = await bcrypt.hash(args.password, 10);

		// create user in DB
		const user = await ctx.db.mutation.createUser({
			data: {
				...args,
				password: password,
				permissions: {set: ['USER']}
			}
		}, info);

		// create JWT token
		const token = jwt.sign({
			userId: user.id
		}, process.env.APP_SECRET);

		// set jwt as cookie
		ctx.response.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
		});

		// return the user to browser
		return user;
	},

	async signin(parent, {email, password}, ctx, info) {
		// check if there is a user with that email
		const user = await ctx.db.query.user({where: {email: email}});
		if (!user) {
			throw new Error(`No such user found for email ${email}`);
		}

		// check if password is correct
		const valid = await bcrypt.compare(password, user.password);
		if (!valid) {
			throw new Error('Invalid Password');
		}

		// generate jwt token
		const token = jwt.sign({
			userId: user.id
		}, process.env.APP_SECRET);

		// set cookie with token
		ctx.response.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
		});

		// return user
		return user;
	},

	signout(parent, args, ctx, info) {
		ctx.response.clearCookie('token');
		return {message: 'Goodbye!'};
	},

	async requestReset(parent, args, ctx, info) {
		// Check if it is a real user
		const user = await ctx.db.query.user({where: {email: args.email }});

		if (!user) {
			throw new Error(`No such user found for email ${args.email}`);
		}

		// set a reset token and expiry on that user
		const randomBytesPromisified = promisify(randomBytes);
		const resetToken = (await randomBytesPromisified(20)).toString('hex');
		const resetTokenExpiry = Date.now() + 3600000; // 1 hour
		const res = await ctx.db.mutation.updateUser({
			where: {email: args.email},
			data: {resetToken, resetTokenExpiry}
		});

		// email them reset token
		const mailResponse = await transport.sendMail({
			from: 'test@test.com',
			to: user.email,
			subject: 'Your password reset',
			html: makeANiceEmail(`Your password reset token is \n\n <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click here to reset</a>`)
		});

		// return the message
		return {message: 'Thanks!'};

	}	,

	async resetPassword(parent, args, ctx, info) {
		// check if passwords match
		if (args.password !== args.confirmPassword) {
			throw new Error('Passwords do not match');
		}

		// check if it is legit reset token
		// check if it is expired
		const [user] = await ctx.db.query.users({
			where: {
				resetToken: args.resetToken,
				resetTokenExpiry_gte: Date.now() - 3600000
			}
		});

		if (!user) {
			throw new Error('This token is either invalid or expired');
		}

		// hash new password
		const password = await bcrypt.hash(args.password, 10);

		// save new password to user and remove old reset token fields
		const updatedUser = await ctx.db.mutation.updateUser({
			where: {email: user.email},
			data: {
				password,
				resetToken: null,
				resetTokenExpiry: null
			}
		});

		// generate jwt
		const token = jwt.sign({userId: updatedUser.id}, process.env.APP_SECRET);

		// set jwt cookie
		ctx.response.cookie('token', token, {
			httpOnly: true,
			maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
		});

		// return the new user
		return updatedUser;
	},

	async updatePermissions(parent, args, ctx, info) {
		// check if login
		if (!ctx.request.userId) {
			throw new Error('You must be logged in');
		}

		// query current user
		const currentUser = await ctx.db.query.user({
			where: {
				id: ctx.request.userId
			}
		}, info);

		// check if they have permission
		hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);

		// update permission
		return ctx.db.mutation.updateUser({
			data: {
				permissions: {
					set: args.permissions
				}
			},
			where: {
				id: args.userId
			}
		}, info);
	},

	async addToCart(parent, args, ctx, info) {
		// signed in?
		const {userId} = ctx.request;
		if (!userId) {
			throw new Error('You must be signed in');
		}

		// query current cart
		const [existingCartItem] = await ctx.db.query.cartItems({
			where: {
				user: {id: userId},
				item: {id: args.id}
			}			
		});

		// check if item is already in cart
		if (existingCartItem) {
			// item already in cart
			return ctx.db.mutation.updateCartItem({
				where: {id: existingCartItem.id},
				data: {quantity: existingCartItem.quantity + 1}
			}, info);
		}

		// if not, create a new cart item for that user
		return ctx.db.mutation.createCartItem({
			data: {
				user: {
					connect: {id: userId}
				},
				item: {
					connect: {id: args.id}
				}
			}
		}, info);
	},

	async removeFromCart(parent, args, ctx, info) {
		// find the cart item
		const cartItem = await ctx.db.query.cartItem({
			where: {
				id: args.id
			}
		}, `{id, user {id}}`);

		// make sure we find an item
		if (!cartItem) throw new Error('No item found');

		// make sure they own the cart item
		if (cartItem.user.id !== ctx.request.userId) {
			throw new Error('Not your item');
		}

		// delete cart item
		return ctx.db.mutation.deleteCartItem({
			where: {
				id: args.id
			}
		}, info);

	},

	async createOrder(parent, args, ctx, info) {
		// query current user and make sure they are signed in
		const {userId} = ctx.request;

		if (!userId) {
			throw new Error('You must be logged in');
		}

		const user = await ctx.db.query.user({
			where: {
				id: userId
			}
		}, `{
			id
			name
			email
			cart {
				id
				quantity
				item {
					title
					price
					id
					description
					image
					largeImage
				}
			}
		}`);

		// recalculate the total for the price
		const amount = user.cart.reduce((tally, cartItem) => tally + cartItem.item.price * cartItem.quantity, 0);

		console.log('Charging ' + amount);

		// create the stripe charge - turn the token into money
		const charge = await stripe.charges.create({
			amount: amount,
			currency: 'MXN',
			source: args.token
		});

		// convert the cart item to order item
		const orderItems = user.cart.map(cartItem => {
			const orderItem = {
				...cartItem.item,
				quantity: cartItem.quantity,
				user: {	connect: {	id: userId } }
			};
			delete orderItem.id;
			return orderItem;
		});

		// create the order
		const order = await ctx.db.mutation.createOrder({
			data: {
				total: charge.amount,
				charge: charge.id,
				items: {create: orderItems},
				user: {connect: {id: userId}}
			}
		});

		// clear the users cart and delete cart items
		const cartItemIds = user.cart.map(cartItem => cartItem.id);
		await ctx.db.mutation.deleteManyCartItems({
			where: {
				id_in: cartItemIds
			}
		});

		// return the order to the client
		return order;
	}

};

module.exports = Mutations;
