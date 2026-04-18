const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop playback, clear the queue, and leave the voice channel"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) return replyError(interaction, "Nothing is playing.");

        await player.destroy();
        await replyOk(interaction, "Stopped and left the voice channel.");
    },
};
