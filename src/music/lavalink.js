const { LavalinkManager } = require("lavalink-client");
const { buildNowPlayingMessage, fetchSuggestions } = require("./nowPlaying");

const TICK_MS = 10_000;

// guildId -> NodeJS.Timeout
const tickIntervals = new Map();
// guildId -> tick counter (used for cycling indicator emoji + gif)
const tickCounters = new Map();

async function autoPlayFunction(player, lastTrack) {
    if (!player.get("autoplay")) return;
    if (!lastTrack?.info?.identifier) return;

    const mixUrl = `https://www.youtube.com/watch?v=${lastTrack.info.identifier}&list=RD${lastTrack.info.identifier}`;
    try {
        const res = await player.search({ query: mixUrl }, lastTrack.requester);
        const candidates = (res?.tracks ?? []).filter(
            (t) => t.info?.identifier && t.info.identifier !== lastTrack.info.identifier,
        );
        const played = new Set((player.queue.previous ?? []).map((t) => t.info?.identifier));
        const next = candidates.find((t) => !played.has(t.info.identifier)) ?? candidates[0];
        if (next) await player.queue.add(next);
    } catch (err) {
        console.warn("[autoplay] failed:", err.message);
    }
}

function stopTick(guildId) {
    const iv = tickIntervals.get(guildId);
    if (iv) clearInterval(iv);
    tickIntervals.delete(guildId);
    tickCounters.delete(guildId);
}

function startTick(player, client) {
    stopTick(player.guildId);
    tickCounters.set(player.guildId, 0);

    const interval = setInterval(async () => {
        if (!player.nowPlayingMessageId || !player.textChannelId) return;
        if (player.paused) return;
        const track = player.queue.current;
        if (!track) return;

        const channel = client.channels.cache.get(player.textChannelId);
        if (!channel) return;

        const tick = (tickCounters.get(player.guildId) ?? 0) + 1;
        tickCounters.set(player.guildId, tick);

        const msg = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
        if (!msg) return;
        await msg
            .edit(buildNowPlayingMessage(player, track, player.get("suggestions"), tick))
            .catch((err) => console.warn("[tick] edit failed:", err.message));
    }, TICK_MS);

    tickIntervals.set(player.guildId, interval);
}

function createLavalink(client, config) {
    const manager = new LavalinkManager({
        nodes: [
            {
                id: "main",
                host: config.lavalink.host,
                port: config.lavalink.port,
                authorization: config.lavalink.password,
                secure: config.lavalink.secure,
                retryAmount: 5,
                retryDelay: 5000,
            },
        ],
        sendToShard: (guildId, payload) =>
            client.guilds.cache.get(guildId)?.shard?.send(payload),
        autoSkip: true,
        client: {
            id: config.clientId,
            username: "Tufan Studio",
        },
        playerOptions: {
            defaultSearchPlatform: "ytsearch",
            applyVolumeAsFilter: false,
            clientBasedPositionUpdateInterval: 150,
            volumeDecrementer: 0.75,
            onDisconnect: { autoReconnect: true, destroyPlayer: false },
            onEmptyQueue: { autoPlayFunction },
            minAutoPlayMs: 3000,
        },
        queueOptions: { maxPreviousTracks: 25 },
    });

    manager.nodeManager
        .on("connect", (node) => console.log(`[lavalink] node ${node.id} connected`))
        .on("error", (node, err) => console.error(`[lavalink] node ${node.id} error:`, err.message))
        .on("disconnect", (node, reason) => console.warn(`[lavalink] node ${node.id} disconnected:`, reason));

    manager
        .on("trackStart", async (player, track) => {
            const channel = client.channels.cache.get(player.textChannelId);
            if (!channel) return;

            try {
                if (player.nowPlayingMessageId) {
                    const old = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                    if (old) await old.delete().catch(() => {});
                }
                player.set("suggestions", null);
                const msg = await channel.send(buildNowPlayingMessage(player, track, null, 0));
                player.nowPlayingMessageId = msg.id;

                startTick(player, client);

                // Async: fetch suggestions, then update the message
                fetchSuggestions(player, track).then(async (suggestions) => {
                    if (suggestions.length === 0) return;
                    if (player.queue.current?.info?.identifier !== track.info.identifier) return;
                    player.set("suggestions", suggestions);
                    const tick = tickCounters.get(player.guildId) ?? 0;
                    const current = await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                    if (current) await current.edit(buildNowPlayingMessage(player, track, suggestions, tick)).catch(() => {});
                });
            } catch (err) {
                console.error("[trackStart] failed:", err.message);
            }
        })
        .on("trackEnd", (player) => {
            stopTick(player.guildId);
        })
        .on("queueEnd", async (player) => {
            stopTick(player.guildId);
            const channel = client.channels.cache.get(player.textChannelId);
            if (player.nowPlayingMessageId) {
                const old = await channel?.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                if (old) await old.delete().catch(() => {});
                player.nowPlayingMessageId = null;
            }
            player.set("suggestions", null);
            channel?.send("Queue finished.").catch(() => {});
        })
        .on("playerDestroy", (player) => {
            stopTick(player.guildId);
        })
        .on("trackError", (player, track, payload) => {
            console.error("[trackError]", track?.info?.title, payload?.exception);
            const channel = client.channels.cache.get(player.textChannelId);
            channel?.send(`Track error: \`${payload?.exception?.message ?? "unknown"}\``).catch(() => {});
        });

    client.on("raw", (d) => manager.sendRawData(d));

    return manager;
}

module.exports = createLavalink;
