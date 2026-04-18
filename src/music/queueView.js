const { EmbedBuilder } = require("discord.js");

const BRAND = 0x5865f2;
const PAGE_SIZE = 10;

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

/**
 * Build a paginated queue embed showing previous, current, and upcoming tracks.
 * Returns null if the requested page is out of range.
 */
function buildQueueEmbed(player, page = 0) {
    const current = player.queue.current;
    if (!current) return null;

    const previous = (player.queue.previous ?? []).slice().reverse(); // oldest → newest visually
    const upcoming = player.queue.tracks ?? [];

    const totalUpcoming = upcoming.length;
    const totalPrevious = previous.length;
    const totalPages = Math.max(1, Math.ceil(Math.max(totalPrevious, totalUpcoming) / PAGE_SIZE));
    if (page < 0 || page >= totalPages) return null;

    const prevSlice = previous.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    const nextSlice = upcoming.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const prevLines = prevSlice.length
        ? prevSlice.map((t, i) => {
              const idx = totalPrevious - (page * PAGE_SIZE + i);
              return `\`${idx}\` ${formatTrack(t)}`;
          })
        : ["_No previous tracks._"];

    const nextLines = nextSlice.length
        ? nextSlice.map((t, i) => {
              const idx = page * PAGE_SIZE + i + 1;
              return `\`${idx}\` ${formatTrack(t)}`;
          })
        : ["_Queue is empty._"];

    const totalDuration = upcoming.reduce((sum, t) => sum + (t.info?.duration ?? 0), 0);

    return new EmbedBuilder()
        .setColor(BRAND)
        .setAuthor({ name: `Queue · Page ${page + 1}/${totalPages}` })
        .addFields(
            {
                name: `⏮ Previous (${totalPrevious})`,
                value: clip(prevLines.join("\n"), 1024),
            },
            {
                name: "🎶 Now Playing",
                value: formatCurrent(current, player),
            },
            {
                name: `⏭ Up Next (${totalUpcoming}${totalUpcoming ? ` · ${fmt(totalDuration)}` : ""})`,
                value: clip(nextLines.join("\n"), 1024),
            },
        )
        .setFooter({
            text: `Vol ${player.volume}% · Loop ${player.repeatMode} · Autoplay ${player.get("autoplay") ? "on" : "off"}`,
        })
        .setTimestamp();
}

function formatTrack(t) {
    const title = clip(t.info?.title ?? "Unknown", 60);
    const link = t.info?.uri ? `[${title}](${t.info.uri})` : `**${title}**`;
    const author = t.info?.author ? ` · ${clip(t.info.author, 30)}` : "";
    const dur = `\`${fmt(t.info?.duration)}\``;
    return `${link}${author} ${dur}`;
}

function formatCurrent(track, player) {
    const title = clip(track.info?.title ?? "Unknown", 80);
    const link = track.info?.uri ? `**[${title}](${track.info.uri})**` : `**${title}**`;
    const author = track.info?.author ? `\n*by ${track.info.author}*` : "";
    const progress = progressBar(player.position ?? 0, track.info?.duration ?? 0);
    return `${link}${author}\n${progress}`;
}

function progressBar(current, total) {
    if (!total) return `\`${fmt(current)}\``;
    const width = 20;
    const filled = Math.min(width, Math.max(0, Math.floor((current / total) * width)));
    const bar = "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, width - filled - 1));
    return `\`${fmt(current)}\` ${bar} \`${fmt(total)}\``;
}

module.exports = { buildQueueEmbed };
