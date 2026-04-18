const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");

const BRAND = 0x5865f2;
const INDICATORS = ["🎵", "🎶", "🎼", "🎧", "💿", "📀"];
const VIBE_GIFS = [
    "https://media.tenor.com/LXrRiMTV-XwAAAAi/cat-cat-meme.gif",
    "https://media.tenor.com/HcBOMXNfQN4AAAAi/headphones-music.gif",
    "https://media.tenor.com/2uyENRmiUt0AAAAi/music-notes.gif",
];

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function clip(s, n) {
    if (!s) return "";
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function progressBar(current, total) {
    if (!total) return `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;
    const width = 22;
    const filled = Math.min(width - 1, Math.max(0, Math.floor((current / total) * width)));
    return "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, width - filled - 1));
}

function buildEmbed(player, track, tickCount = 0) {
    const info = track.info;
    const requester = track.requester ?? "unknown";
    const loopLabels = { off: "Off", track: "Song", queue: "Queue" };
    const loopMode = loopLabels[player.repeatMode] ?? "Off";
    const autoplay = player.get("autoplay") ? "On" : "Off";

    const indicator = INDICATORS[tickCount % INDICATORS.length];
    const vibeGif = VIBE_GIFS[Math.floor(tickCount / INDICATORS.length) % VIBE_GIFS.length];

    const pos = player.position ?? 0;
    const dur = info.duration ?? 0;
    const isLive = !dur || dur < 0;
    const bar = isLive
        ? "🔴 LIVE"
        : `\`${fmt(pos)}\` ${progressBar(pos, dur)} \`${fmt(dur)}\``;

    const previous = (player.queue.previous ?? []).slice(0, 3);
    const upcoming = (player.queue.tracks ?? []).slice(0, 3);
    const totalPrev = player.queue.previous?.length ?? 0;
    const totalNext = player.queue.tracks?.length ?? 0;

    const prevLines = previous.length
        ? previous.map((t, i) => `\`${i + 1}\` ${formatLine(t)}`).join("\n")
          + (totalPrev > 3 ? `\n*…and ${totalPrev - 3} more*` : "")
        : "_None yet._";

    const nextLines = upcoming.length
        ? upcoming.map((t, i) => `\`${i + 1}\` ${formatLine(t)}`).join("\n")
          + (totalNext > 3 ? `\n*…and ${totalNext - 3} more*` : "")
        : "_Queue is empty._";

    const titleSuffix = player.paused ? " ⏸" : "";

    return new EmbedBuilder()
        .setColor(BRAND)
        .setAuthor({ name: `${indicator}  Now Playing${titleSuffix}` })
        .setTitle(info.title)
        .setURL(info.uri)
        .setDescription(`by **${info.author}**\n\n${bar}`)
        .addFields(
            { name: "Volume", value: `${player.volume}%`, inline: true },
            { name: "Loop", value: loopMode, inline: true },
            { name: "Autoplay", value: autoplay, inline: true },
            { name: "Requested by", value: `${requester}`, inline: true },
            { name: "Queue", value: `${totalNext} track(s)`, inline: true },
            { name: "Duration", value: fmt(info.duration), inline: true },
            { name: `⏮ Previous (${totalPrev})`, value: clip(prevLines, 1024) },
            { name: `⏭ Up Next (${totalNext})`, value: clip(nextLines, 1024) },
        )
        .setThumbnail(info.artworkUrl ?? null)
        .setImage(vibeGif)
        .setFooter({ text: `Tufan Studio · controls below · beat #${tickCount + 1}` })
        .setTimestamp();
}

function formatLine(t) {
    const title = clip(t.info?.title ?? "Unknown", 55);
    const link = t.info?.uri ? `[${title}](${t.info.uri})` : `**${title}**`;
    return `${link} · \`${fmt(t.info?.duration)}\``;
}

function buildButtons(player) {
    const paused = player.paused;
    const loopActive = player.repeatMode !== "off";
    const autoplay = Boolean(player.get("autoplay"));

    const row1 = new ActionRowBuilder().addComponents(
        btn("music:prev", "⏮", ButtonStyle.Secondary),
        btn("music:toggle", paused ? "▶️" : "⏸", paused ? ButtonStyle.Success : ButtonStyle.Primary, paused ? "Resume" : "Pause"),
        btn("music:skip", "⏭", ButtonStyle.Secondary, "Skip"),
        btn("music:stop", "⏹", ButtonStyle.Danger, "Stop"),
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

    const row4 = new ActionRowBuilder().addComponents(
        btn("music:plist-save", "💾", ButtonStyle.Secondary, "Save"),
        btn("music:plist-load", "📂", ButtonStyle.Secondary, "Load"),
        btn("music:plist-create", "➕", ButtonStyle.Secondary, "Create"),
        btn("music:plist-delete", "🗑", ButtonStyle.Secondary, "Delete"),
    );

    return [row1, row2, row3, row4];
}

function buildSuggestionsRow(suggestions) {
    if (!suggestions || suggestions.length === 0) return null;

    const menu = new StringSelectMenuBuilder()
        .setCustomId("music:suggest")
        .setPlaceholder(`🎶 Pick a suggested track (${suggestions.length} available)`)
        .setMinValues(1)
        .setMaxValues(1);

    const options = suggestions.slice(0, 25).map((track, i) => ({
        label: clip(track.info.title ?? "Unknown", 100),
        description: clip(`${track.info.author ?? "Unknown"} · ${fmt(track.info.duration)}`, 100),
        value: String(i),
        emoji: "🎶",
    }));

    menu.addOptions(options);
    return new ActionRowBuilder().addComponents(menu);
}

function btn(id, emoji, style, label) {
    const b = new ButtonBuilder().setCustomId(id).setStyle(style).setEmoji(emoji);
    if (label) b.setLabel(label);
    return b;
}

function buildNowPlayingMessage(player, track, suggestions, tickCount = 0) {
    const components = buildButtons(player);
    const suggestRow = buildSuggestionsRow(suggestions ?? player.get("suggestions"));
    if (suggestRow) components.push(suggestRow);
    return { embeds: [buildEmbed(player, track, tickCount)], components };
}

async function fetchSuggestions(player, track) {
    if (!track?.info?.identifier) return [];
    const mixUrl = `https://www.youtube.com/watch?v=${track.info.identifier}&list=RD${track.info.identifier}`;
    try {
        const res = await player.search({ query: mixUrl }, track.requester);
        const tracks = (res?.tracks ?? []).filter((t) => t.info?.identifier !== track.info.identifier);
        return tracks.slice(0, 20);
    } catch (err) {
        console.warn("[suggestions] fetch failed:", err.message);
        return [];
    }
}

module.exports = {
    buildNowPlayingMessage,
    buildEmbed,
    buildButtons,
    buildSuggestionsRow,
    fetchSuggestions,
};
