const { Events } = require("discord.js");
const { registerGuild } = require("../utils/registerCommands");

module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        try {
            const count = await registerGuild(client, guild.id);
            console.log(`[guildCreate] joined ${guild.name} (${guild.id}) — deployed ${count} cmds`);
        } catch (err) {
            console.error(`[guildCreate] deploy failed for ${guild.name}:`, err);
        }
    },
};
