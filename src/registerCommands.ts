import "dotenv/config";
import { REST, Routes } from "discord.js";
import { commands } from "./commands/index.js";

/**
 * Reads a required environment variable.
 *
 * @param name - The environment variable name.
 * @returns The configured environment variable value.
 * @throws Error when the variable is missing or empty.
 */
function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

/**
 * Registers BandRip slash commands against the configured Discord guild.
 */
async function main(): Promise<void> {
    const token = requireEnv("DISCORD_TOKEN");
    const clientId = requireEnv("DISCORD_CLIENT_ID");
    const guildId = requireEnv("DISCORD_GUILD_ID");

    const rest = new REST({ version: "10" }).setToken(token);
    const commandBody = commands.map((command) => command.data.toJSON());

    console.log(`Registering ${commandBody.length} guild commands...`);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandBody,
    });

    console.log("BandRip guild commands registered.");
}

void main().catch((error: unknown) => {
    console.error("Failed to register BandRip commands:", error);
    process.exit(1);
});