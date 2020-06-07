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
	}
	/*createDog(parent, args, ctx, info) {
		// create a dog
		console.log(args);
	}*/
};

module.exports = Mutations;
