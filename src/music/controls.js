const { buildNowPlayingMessage } = require("./nowPlaying");

/**
 * Handle a button click from the Now Playing embed.
 * Returns { ok: boolean, message?: string }.
 */
async function handleMusicButton(interaction, client) {
    const [prefix, action] = interaction.customId.split(":");
    if (prefix !== "music") return { ok: false, message: "Unknown control." };

    const player = client.lavalink.getPlayer(interaction.guildId);
    if (!player) return { ok: false, message: "Nothing is playing." };

    const memberVoice = interaction.member?.voice?.channelId;
    if (memberVoice && player.voiceChannelId && memberVoice !== player.voiceChannelId) {
        return { ok: false, message: "Join my voice channel to control playback." };
    }

    switch (action) {
        case "toggle": {
            if (player.paused) await player.resume();
            else await player.pause();
            return { ok: true, message: player.paused ? "Paused." : "Resumed." };
        }
        case "skip": {
            if (!player.queue.current) return { ok: false, message: "Nothing to skip." };
            await player.skip();
            return { ok: true, message: "Skipped." };
        }
        case "prev": {
            const prev = player.queue.previous?.[0];
            if (!prev) return { ok: false, message: "No previous track." };
            await player.queue.add(prev, 0);
            await player.skip(0, false);
            return { ok: true, message: "Previous track." };
        }
        case "stop": {
            await player.destroy();
            return { ok: true, message: "Stopped and left the voice channel." };
        }
        case "vol-down": {
            const v = Math.max(0, player.volume - 10);
            await player.setVolume(v);
            return { ok: true, message: `Volume: ${v}%` };
        }
        case "vol-up": {
            const v = Math.min(150, player.volume + 10);
            await player.setVolume(v);
            return { ok: true, message: `Volume: ${v}%` };
        }
        case "loop": {
            const next = player.repeatMode === "off" ? "track" : player.repeatMode === "track" ? "queue" : "off";
            await player.setRepeatMode(next);
            return { ok: true, message: `Loop: ${next}` };
        }
        case "shuffle": {
            if (player.queue.tracks.length < 2) return { ok: false, message: "Need at least 2 tracks in queue." };
            await player.queue.shuffle();
            return { ok: true, message: "Queue shuffled." };
        }
        case "autoplay": {
            const current = Boolean(player.get("autoplay"));
            player.set("autoplay", !current);
            return { ok: true, message: `Autoplay: ${!current ? "On" : "Off"}` };
        }
        case "queue": {
            const tracks = player.queue.tracks;
            if (tracks.length === 0) return { ok: true, message: "Queue is empty." };
            const lines = tracks.slice(0, 10).map((t, i) => `\`${i + 1}.\` **${t.info.title}** · ${fmt(t.info.duration)}`);
            const more = tracks.length > 10 ? `\n...and ${tracks.length - 10} more` : "";
            return { ok: true, message: lines.join("\n") + more };
        }
        default:
            return { ok: false, message: "Unknown action." };
    }
}

function fmt(ms) {
    if (!ms || ms < 0) return "LIVE";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Refresh the Now Playing message's embed + buttons to reflect current state.
 */
async function refreshNowPlaying(player, client) {
    if (!player.nowPlayingMessageId || !player.textChannelId) return;
    const channel = client.channels.cache.get(player.textChannelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
    if (!msg) return;
    const track = player.queue.current;
    if (!track) return;
    await msg.edit(buildNowPlayingMessage(player, track)).catch(() => {});
}

module.exports = { handleMusicButton, refreshNowPlaying };
