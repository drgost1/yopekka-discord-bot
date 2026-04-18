const { LavalinkManager } = require("lavalink-client");
const { buildNowPlayingMessage } = require("./nowPlaying");

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
            onEmptyQueue: { destroyAfterMs: 60_000 },
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
                const msg = await channel.send(buildNowPlayingMessage(player, track));
                player.nowPlayingMessageId = msg.id;
            } catch (err) {
                console.error("[trackStart] failed to send now-playing:", err.message);
            }
        })
        .on("queueEnd", async (player) => {
            const channel = client.channels.cache.get(player.textChannelId);
            if (player.nowPlayingMessageId) {
                const old = await channel?.messages.fetch(player.nowPlayingMessageId).catch(() => null);
                if (old) await old.delete().catch(() => {});
                player.nowPlayingMessageId = null;
            }
            channel?.send("Queue finished.").catch(() => {});
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
