const fs = require("fs");
const path = require("path");

/**
 * Recursively loads every .js file under src/commands/** as a slash command.
 * Each command module must export { data: SlashCommandBuilder, execute: (interaction, client) => void }.
 * Folders are treated purely for organisation — they don't affect command names.
 */
function loadCommands(client) {
    const commandsDir = path.join(__dirname, "..", "commands");
    if (!fs.existsSync(commandsDir)) return;

    const files = walk(commandsDir).filter((f) => f.endsWith(".js"));
    for (const file of files) {
        const command = require(file);
        if (!command?.data?.name || typeof command.execute !== "function") {
            console.warn(`[commandHandler] skipped ${path.relative(commandsDir, file)} — missing data/execute`);
            continue;
        }
        client.commands.set(command.data.name, command);
    }
    console.log(`[commandHandler] loaded ${client.commands.size} command(s)`);
}

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

module.exports = loadCommands;
