const { SlashCommandBuilder } = require("discord.js");
const { replyError, replyOk } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Shuffle the queue"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || player.queue.tracks.length < 2) {
            return replyError(interaction, "Need at least 2 songs in the queue to shuffle.");
        }
        await player.queue.shuffle();
        await replyOk(interaction, "Queue shuffled.");
    },
};
