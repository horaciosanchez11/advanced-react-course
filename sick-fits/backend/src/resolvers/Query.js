const Query = {
	dogs(parent, args, ctx, info) {
		return [{name: 'Snickers'}, {name: 'Pluto'}]
	},
};

module.exports = Query;
