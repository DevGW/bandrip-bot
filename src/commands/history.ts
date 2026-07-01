import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BandRipCommand } from "./command.js";
import type { RipJob } from "../services/jobService.js";
import { listJobsForUser } from "../services/jobService.js";
import { findUserForTenant } from "../services/userService.js";

/**
 * Formats the source label for a rip job.
 *
 * @param job - Rip job to format.
 * @returns Human-readable source label.
 */
function formatJobSource(job: RipJob): string {
    if (job.sourceType === "url") {
        return job.sourceUrl ?? "URL";
    }

    return job.inputFilename ?? "attachment";
}

/**
 * Formats a rip job for Discord display.
 *
 * @param job - Rip job to format.
 * @returns One-line job summary.
 */
function formatJobLine(job: RipJob): string {
    const createdAt = new Date(job.createdAt).toLocaleString();
    const source = formatJobSource(job);

    return `${job.id} | ${job.status} | ${createdAt} | ${source}`;
}

/**
 * Handles the /history command.
 */
export const historyCommand: BandRipCommand = {
    name: "history",

    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("Show your previous BandRip jobs in this server."),

    /**
     * Shows recent rip jobs for the current registered Discord user.
     *
     * @param interaction - Discord slash command interaction.
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "BandRip history must be used inside a Discord server.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const user = findUserForTenant(interaction.guildId, interaction.user.id);

        if (!user) {
            await interaction.reply({
                content: "You need to run /register before using /history.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const jobs = listJobsForUser(interaction.guildId, user.id, 10);

        if (jobs.length === 0) {
            await interaction.reply({
                content: "No rip history yet.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const historyLines = jobs.map(formatJobLine).join("\n");

        await interaction.reply({
            content: `Recent rip jobs:\n\`\`\`\n${historyLines}\n\`\`\``,
            flags: MessageFlags.Ephemeral,
        });
    },
};