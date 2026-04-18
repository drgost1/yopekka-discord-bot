const { SlashCommandBuilder } = require("discord.js");
const { replyError } = require("../../utils/embeds");
const { buildNowPlayingMessage } = require("../../music/nowPlaying");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Show the currently playing song"),
    async execute(interaction, client) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) return replyError(interaction, "Nothing is playing.");

        await interaction.reply(buildNowPlayingMessage(player, player.queue.current));
    },
};
