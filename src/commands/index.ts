import type { BandRipCommand } from "./command.js";
import { historyCommand } from "./history.js";
import { registerCommand } from "./register.js";
import { ripCommand } from "./rip.js";

/**
 * All BandRip slash commands.
 */
export const commands: BandRipCommand[] = [
    registerCommand,
    ripCommand,
    historyCommand,
];

/**
 * Maps command names to command handlers.
 */
export const commandMap = new Map<string, BandRipCommand>(
    commands.map((command) => [command.name, command]),
);

/**
 * Finds a command handler by command name.
 *
 * @param name - Discord slash command name.
 * @returns The matching command handler, or undefined when no command exists.
 */
export function getCommand(name: string): BandRipCommand | undefined {
    return commandMap.get(name);
}