/**
 * Middleware that checks if the incoming request contains a valid JWT and authenticate the users.
 * @param {*} request 
 * @param {*} reply 
 * @returns 
 */

export const authenticationToken = async (request, reply) => {
	try {
		/**
		 * extract the token from the Authorization header.
		 * Removes the "Bearer " prefix
		 * if the header doesn't exist, token becomes undefined.
		 */
		const token = request.headers.authorization?.replace('Bearer ', '');
		if (!token) {
			return reply.status(401).send({
				error: 'Access denied. No token provided.'
			});
		}
		/**
		 * If the token is valid decode the payload and assigns it to request.user
		 */
		const decoded = await request.jwtVerify();
		request.user = decoded;
	} catch (error) {
		return reply.status(403).send({
			error: 'Invalid token.'
		});
	}
};