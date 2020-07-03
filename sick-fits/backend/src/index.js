// let's go!
// this is the entry point of the application
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });
const createServer = require('./createServer');
const db = require('./db');

const server = createServer();

//TODO: Use Express middleware to handles cookies (JWT) - DONE!!
server.express.use(cookieParser());

// decode JWT to get user Id on each request
server.express.use((req, res, next) => {
	const {token} = req.cookies;
	if (token) {
		const {userId} = jwt.verify(token, process.env.APP_SECRET);

		// put user Id onto request
		req.userId = userId;
	}

	next();
});

// create a middleware that populates the user on each request
server.express.use(async (req, res, next) => {
	// if they are not logged in, skip this
	if (!req.userId) return next();

	const user = await db.query.user({
		where: {
				id: req.userId
			}
		}, '{id, permissions, email, name}'
	);
	req.user = user;
	next();
});

//TODO: Use Express middleware to populate current user

server.start({
	cors: {
		credentials: true,
		origin: process.env.FRONTEND_URL,
	},

}, deets => {
	console.log(`Server is now running on port http://localhost:${deets.port}`)
});