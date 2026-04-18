const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { replyError } = require("../../utils/embeds");
const { playQuery } = require("../../music/playQuery");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song from a URL or search query")
        .addStringOption((opt) =>
            opt.setName("query")
                .setDescription("URL or search terms (YouTube, Spotify, SoundCloud, etc.)")
                .setRequired(true),
        ),
    async execute(interaction, client) {
        const query = interaction.options.getString("query", true);
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: "Join a voice channel first.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        const res = await playQuery(client, {
            guildId: interaction.guildId,
            voiceChannel,
            textChannelId: interaction.channelId,
            user: interaction.user,
            member: interaction.member,
            query,
        });

        if (!res.ok) return replyError(interaction, res.message);

        if (res.track) {
            await interaction.editReply(`Queued: **${res.track.info.title}**`);
        } else {
            await interaction.editReply(
                `Queued playlist **${res.playlist?.name ?? "Unknown"}** — ${res.playlistLength} tracks`,
            );
        }
    },
};
