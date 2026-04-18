const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { replyError } = require("../../utils/embeds");

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

        let player = client.lavalink.getPlayer(interaction.guildId);
        if (!player) {
            player = client.lavalink.createPlayer({
                guildId: interaction.guildId,
                voiceChannelId: voiceChannel.id,
                textChannelId: interaction.channelId,
                selfDeaf: true,
                selfMute: false,
                volume: 80,
            });
        }

        if (!player.connected) {
            try {
                await player.connect();
            } catch (err) {
                return replyError(interaction, `Voice connect failed: ${err.message}`);
            }
        }

        const res = await player.search({ query, source: "ytsearch" }, interaction.user).catch(() => null);

        if (!res || !res.tracks?.length) {
            return replyError(interaction, `No results for **${query}**.`);
        }

        if (res.loadType === "playlist") {
            await player.queue.add(res.tracks);
            await interaction.editReply({
                content: `Added playlist **${res.playlist?.name ?? "Unknown"}** — ${res.tracks.length} tracks`,
            });
        } else {
            const track = res.tracks[0];
            await player.queue.add(track);
            await interaction.editReply({
                content: `Queued: **${track.info.title}** · \`${fmt(track.info.duration)}\``,
            });
        }

        if (!player.playing && !player.paused) {
            await player.play();
        }
    },
};

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}
