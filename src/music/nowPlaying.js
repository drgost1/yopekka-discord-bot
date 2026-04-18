const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");

const BRAND = 0x5865f2;

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function buildEmbed(player, track) {
    const info = track.info;
    const requester = track.requester ?? "unknown";
    const loopLabels = { off: "Off", track: "Song", queue: "Queue" };
    const loopMode = loopLabels[player.repeatMode] ?? "Off";
    const autoplay = player.get("autoplay") ? "On" : "Off";

    return new EmbedBuilder()
        .setColor(BRAND)
        .setTitle("Now Playing")
        .setDescription(`**[${info.title}](${info.uri})**\n${info.author}`)
        .addFields(
            { name: "Duration", value: fmt(info.duration), inline: true },
            { name: "Requested by", value: `${requester}`, inline: true },
            { name: "Volume", value: `${player.volume}%`, inline: true },
            { name: "Loop", value: loopMode, inline: true },
            { name: "Autoplay", value: autoplay, inline: true },
            { name: "Queue", value: `${player.queue.tracks.length} track(s)`, inline: true },
        )
        .setThumbnail(info.artworkUrl ?? null)
        .setTimestamp();
}

function buildButtons(player) {
    const paused = player.paused;
    const loopActive = player.repeatMode !== "off";
    const autoplay = Boolean(player.get("autoplay"));

    const row1 = new ActionRowBuilder().addComponents(
        btn("music:prev", "⏮", ButtonStyle.Secondary),
        btn("music:toggle", paused ? "▶️" : "⏸", paused ? ButtonStyle.Success : ButtonStyle.Primary),
        btn("music:skip", "⏭", ButtonStyle.Secondary),
        btn("music:stop", "⏹", ButtonStyle.Danger),
    );

    const row2 = new ActionRowBuilder().addComponents(
        btn("music:vol-down", "🔉", ButtonStyle.Secondary),
        btn("music:vol-up", "🔊", ButtonStyle.Secondary),
        btn("music:loop", "🔁", loopActive ? ButtonStyle.Success : ButtonStyle.Secondary),
        btn("music:shuffle", "🔀", ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
        btn("music:autoplay", "🎵", autoplay ? ButtonStyle.Success : ButtonStyle.Secondary, "Autoplay"),
        btn("music:queue", "📜", ButtonStyle.Secondary, "Queue"),
    );

    return [row1, row2, row3];
}

function btn(id, emoji, style, label) {
    const b = new ButtonBuilder().setCustomId(id).setStyle(style).setEmoji(emoji);
    if (label) b.setLabel(label);
    return b;
}

function buildNowPlayingMessage(player, track) {
    return { embeds: [buildEmbed(player, track)], components: buildButtons(player) };
}

module.exports = { buildNowPlayingMessage, buildEmbed, buildButtons };
