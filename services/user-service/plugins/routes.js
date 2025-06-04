
//importing fastify
const fastify = require('fastify')({ logger: true });

//2-routing for default page
function routes(fastify, options, done) {
    //checking if a User has not been created.
    // if (!user)
    // {
    //     const err = new error();
    //     err.message = "Unauthorize User"
    //     throw err;
    // }
    fastify.get("/", async (request, reply) => {
        return { message: 'User default page is working ...' };
    });

    //2-routing for dashboard
    fastify.get("/dashboard", async (request, reply) => {
        return { message: "Dashboard page is here" };
    });

    //2-routing for play
    fastify.get("/play", async (request, reply) => {
        return { message: "play page is here" };
    });

    //2-routing for leaderboard
    fastify.get("/leaderboard", async (request, reply) => {
        return { message: "leaderboard page is here" };
    });

    //2-routing for tournament
    fastify.get("/tournament", async (request, reply) => {
        return { message: "tournament page is here" };
    });
    //2-routing for profile
    fastify.get("/chat", async (request, reply) => {
        return { message: "chatting page is here" };
    });
    //2-routing for profile
    fastify.get("/profile", async (request, reply) => {
        return { message: "profile page is here" };
    });

    //2-routing for settings
    fastify.get("/settings", async (request, reply) => {
        return { message: "Dashboard page is here" };
    });

    //2-routing for logout
    fastify.get("/logout", async (request, reply) => {
        return { message: "logging out of page now" };
    });

    done();
};

module.exports = routes