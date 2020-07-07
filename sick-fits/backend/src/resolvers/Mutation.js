const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {randomBytes} = require('crypto');
const{promisify} = require('util');
const {transport, makeANiceEmail} = require('../mail');
const {hasPermission} = require('../utils');

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
	}

};

module.exports = Mutations;
