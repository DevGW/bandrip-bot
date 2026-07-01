import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { BandRipCommand } from "./command.js";
import { registerDiscordUserForTenant } from "../services/userService.js";

/**
 * Handles the /register command.
 */
export const registerCommand: BandRipCommand = {
    name: "register",

    data: new SlashCommandBuilder()
        .setName("register")
        .setDescription("Register your Discord user for BandRip."),

    /**
     * Registers the current Discord user for the current Discord guild.
     *
     * @param interaction - The Discord command interaction.
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "BandRip registration must be used inside a Discord server.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const user = registerDiscordUserForTenant(
            interaction.guildId,
            interaction.user.id,
        );

        await interaction.reply({
            content: `Registered as ${user.id}. You can now use /rip and /history.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};