import type {
    ChatInputCommandInteraction,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

/**
 * Represents a JSON-serializable Discord slash command definition.
 */
export interface SlashCommandData {
    /**
     * Converts the command definition into the payload Discord expects.
     *
     * @returns Discord REST command JSON.
     */
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

/**
 * Represents a BandRip slash command.
 */
export interface BandRipCommand {
    /**
     * Command name used by Discord and the local dispatcher.
     */
    name: string;

    /**
     * Slash command definition registered with Discord.
     */
    data: SlashCommandData;

    /**
     * Handles an incoming Discord slash command interaction.
     *
     * @param interaction - The Discord interaction for this command.
     */
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}