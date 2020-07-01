const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const Mutations = {
	async createItem(parent, args, ctx, info) {
		// TODO Check if they are logged in
		// Here we are going to interface with the Prisma database, the API is everything inside prisma.graphq
		const item = await ctx.db.mutation.createItem({
			data: {
				// Spreading the args argument
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
		}`);

		// check if they own the item or have the permissions


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
	}

};

module.exports = Mutations;
