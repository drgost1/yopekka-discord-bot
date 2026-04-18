/**
 * Resolve and play a query into a player. Reusable between /play, the music-channel
 * listener, and any other entry points.
 *
 * Returns:
 *   { ok: true, track | playlist, playlistLength? }
 *   { ok: false, reason: "no-voice" | "no-results" | "connect-failed" | "error", message }
 */
async function playQuery(client, { guildId, voiceChannel, textChannelId, user, member, query }) {
    if (!voiceChannel) {
        return { ok: false, reason: "no-voice", message: "Join a voice channel first." };
    }

    let player = client.lavalink.getPlayer(guildId);
    if (!player) {
        player = client.lavalink.createPlayer({
            guildId,
            voiceChannelId: voiceChannel.id,
            textChannelId,
            selfDeaf: true,
            volume: 80,
        });
    }

    if (!player.connected) {
        try { await player.connect(); }
        catch (err) {
            return { ok: false, reason: "connect-failed", message: `Voice connect failed: ${err.message}` };
        }
    }

    const res = await player.search({ query, source: "ytsearch" }, user).catch(() => null);
    if (!res || !res.tracks?.length) {
        return { ok: false, reason: "no-results", message: `No results for **${query}**.` };
    }

    let summary;
    if (res.loadType === "playlist") {
        await player.queue.add(res.tracks);
        summary = { ok: true, playlist: res.playlist, tracks: res.tracks, playlistLength: res.tracks.length };
    } else {
        const track = res.tracks[0];
        await player.queue.add(track);
        summary = { ok: true, track };
    }

    if (!player.playing && !player.paused) {
        await player.play();
    }

    return summary;
}

module.exports = { playQuery };
