import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Attachment, ChatInputCommandInteraction } from "discord.js";
import type { BandRipCommand } from "./command.js";
import { createQueuedRipJob } from "../services/jobService.js";
import { findUserForTenant } from "../services/userService.js";

/**
 * Allowed uploaded video extensions for the initial demo.
 */
const allowedVideoExtensions = new Set([".mp4", ".mov", ".webm", ".mkv"]);

/**
 * Checks whether a value is a valid HTTP or HTTPS URL.
 *
 * @param value - Candidate URL.
 * @returns True when the value is a valid HTTP or HTTPS URL.
 */
function isValidHttpUrl(value: string): boolean {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * Gets the lowercase extension from a Discord attachment filename.
 *
 * @param attachment - Discord attachment.
 * @returns File extension including the leading dot, or an empty string.
 */
function getAttachmentExtension(attachment: Attachment): string {
    const lastDotIndex = attachment.name.lastIndexOf(".");

    if (lastDotIndex === -1) {
        return "";
    }

    return attachment.name.slice(lastDotIndex).toLowerCase();
}

/**
 * Handles the /rip command.
 */
export const ripCommand: BandRipCommand = {
    name: "rip",

    data: new SlashCommandBuilder()
        .setName("rip")
        .setDescription("Extract MP3 audio from a video URL or uploaded file.")
        .addStringOption((option) =>
            option
                .setName("url")
                .setDescription("A permissioned media URL to process.")
                .setRequired(false),
        )
        .addAttachmentOption((option) =>
            option
                .setName("file")
                .setDescription("An uploaded video file to process.")
                .setRequired(false),
        ),

    /**
     * Creates a queued rip job from either a URL or uploaded video file.
     *
     * @param interaction - Discord slash command interaction.
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "BandRip must be used inside a Discord server.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const user = findUserForTenant(interaction.guildId, interaction.user.id);

        if (!user) {
            await interaction.reply({
                content: "You need to run /register before using /rip.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const url = interaction.options.getString("url");
        const file = interaction.options.getAttachment("file");

        if (!url && !file) {
            await interaction.reply({
                content: "Provide either a URL or a video attachment.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (url && file) {
            await interaction.reply({
                content: "Provide either a URL or a file, not both.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (url && !isValidHttpUrl(url)) {
            await interaction.reply({
                content: "The URL must be a valid HTTP or HTTPS URL.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (file) {
            const extension = getAttachmentExtension(file);

            if (!allowedVideoExtensions.has(extension)) {
                await interaction.reply({
                    content: "Uploaded files must be one of: mp4, mov, webm, mkv.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        const job = createQueuedRipJob({
            tenantId: interaction.guildId,
            userId: user.id,
            sourceType: url ? "url" : "attachment",
            sourceUrl: url ?? file?.url ?? null,
            inputFilename: file?.name ?? null,
        });

        await interaction.reply({
            content: `Rip job queued: ${job.id}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};