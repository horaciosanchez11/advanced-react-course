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
	}

};

module.exports = Mutations;
