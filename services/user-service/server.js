// 1- importing fastify and other dependencies
import Fastify from 'fastify';
import path from 'path';
import routesPath from './plugins/routes.js';
import webFiles from "@fastify/static";


//instantiating fastify
const fastify = Fastify({ logger: true });
//register the external route
fastify.register(routesPath)

fastify.register(webFiles, {
  root: path.join(process.cwd(), "public"),
});


//listening at localhost on port 3002
const init = async () => {
    try {
        await fastify.listen({ port: 3002 }, (err, address) => {
            fastify.log.info(`Server is running smoothly ... at ${address}`);
        });
    }
    catch (err) {
        console.log(err);
        fastify.log.error(err);
        process.exit(1);
    }
}

init();