import "dotenv/config";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { getCommand } from "./commands/index.js";
import { initializeDatabase } from "./db/database.js";
import { requireEnv } from "./services/configService.js";
import { startRipWorker } from "./workers/ripWorker.js";
import { startCleanupService } from "./services/cleanupService.js";

/**
 * Reads the configured output time-to-live from the environment.
 *
 * @returns Output TTL in minutes. Defaults to 60 when unset or invalid.
 */
function getOutputTtlMinutes(): number {
    const rawValue = process.env.OUTPUT_TTL_MINUTES ?? "60";
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return 60;
    }

    return parsedValue;
}

/**
 * Starts the BandRip Discord bot.
 *
 * This initializes persistence, connects to Discord, starts the background
 * worker after the client is ready, and dispatches slash command interactions.
 */
async function main(): Promise<void> {
    initializeDatabase();

    startCleanupService({
        pollIntervalMs: 60_000,
        batchSize: 25,
    });

    const token = requireEnv("DISCORD_TOKEN");

    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });

    let workerStarted = false;

    client.once(Events.ClientReady, (readyClient) => {
        console.log(`BandRip connected as ${readyClient.user.tag}`);

        if (!workerStarted) {
            workerStarted = true;

            startRipWorker(readyClient, {
                pollIntervalMs: 2_000,
                outputTtlMinutes: getOutputTtlMinutes(),
            });
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        const command = getCommand(interaction.commandName);

        if (!command) {
            await interaction.reply({
                content: "Unknown BandRip command.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error: unknown) {
            console.error(`Command failed: ${interaction.commandName}`, error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "Command failed. Check the bot logs.",
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: "Command failed. Check the bot logs.",
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    });

    await client.login(token);
}

void main().catch((error: unknown) => {
    console.error("BandRip failed to start:", error);
    process.exit(1);
});