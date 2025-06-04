// 1- importing fastify
// import { User } from '../auth-service/src/user.js';
const fastify = require('fastify')({ logger: true });
fastify.register(require('./plugins/routes.js'));

//listening at localhost on port 3001
const init = async () => {
    try {
        await fastify.listen({ port: 3001 }, (err, address) => {
            fastify.log.info(`Server is running smoothly ... at ${address}`);
        });
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

init();