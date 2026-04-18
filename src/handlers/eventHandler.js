const fs = require("fs");
const path = require("path");

/**
 * Loads every .js file under src/events/ as a client event listener.
 * Each event module must export { name, once?, execute }.
 */
function loadEvents(client) {
    const eventsDir = path.join(__dirname, "..", "events");
    if (!fs.existsSync(eventsDir)) return;

    let count = 0;
    for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith(".js"))) {
        const event = require(path.join(eventsDir, file));
        if (!event?.name || typeof event.execute !== "function") {
            console.warn(`[eventHandler] skipped ${file} — missing name/execute`);
            continue;
        }
        const handler = (...args) => event.execute(...args, client);
        if (event.once) client.once(event.name, handler);
        else client.on(event.name, handler);
        count++;
    }
    console.log(`[eventHandler] loaded ${count} event(s)`);
}

module.exports = loadEvents;
