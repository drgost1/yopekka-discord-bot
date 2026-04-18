const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Resume the paused song"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) return replyError(interaction, "Nothing is playing.");
        if (!player.paused) return replyError(interaction, "Not paused.");

        await player.resume();
        await replyOk(interaction, "Resumed.");
    },
};
