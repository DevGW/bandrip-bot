import "dotenv/config";

/**
 * Reads a required environment variable.
 *
 * @param name - The environment variable name.
 * @returns The configured environment variable value.
 * @throws Error when the variable is missing or empty.
 */
export function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}