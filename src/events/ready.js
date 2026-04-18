const { Events, ActivityType } = require("discord.js");
const { registerAllGuilds } = require("../utils/registerCommands");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`[ready] logged in as ${client.user.tag} (${client.user.id})`);
        console.log(`[ready] in ${client.guilds.cache.size} guild(s)`);

        client.user.setPresence({
            activities: [{ name: "/play · your tunes", type: ActivityType.Listening }],
            status: "online",
        });

        await client.lavalink.init(client.user);
        await registerAllGuilds(client);
    },
};
