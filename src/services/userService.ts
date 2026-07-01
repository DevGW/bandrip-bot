import { nanoid } from "nanoid";
import { db } from "../db/database.js";

/**
 * Represents a registered BandRip user.
 */
export interface BandRipUser {
    id: string;
    discordUserId: string;
    createdAt: string;
}

/**
 * Converts an unknown SQLite row into a BandRip user.
 *
 * @param row - Raw SQLite row.
 * @returns A typed BandRip user.
 */
function mapUserRow(row: unknown): BandRipUser {
    const userRow = row as {
        id: string;
        discord_user_id: string;
        created_at: string;
    };

    return {
        id: userRow.id,
        discordUserId: userRow.discord_user_id,
        createdAt: userRow.created_at,
    };
}

/**
 * Finds a BandRip user by Discord user ID.
 *
 * @param discordUserId - Discord user ID from the interaction payload.
 * @returns The matching user, or undefined if not registered.
 */
export function findUserByDiscordId(discordUserId: string): BandRipUser | undefined {
    const row = db
        .prepare("SELECT id, discord_user_id, created_at FROM users WHERE discord_user_id = ?")
        .get(discordUserId);

    return row ? mapUserRow(row) : undefined;
}

/**
 * Registers the Discord user if they do not already exist.
 *
 * @param discordUserId - Discord user ID from the interaction payload.
 * @returns The existing or newly created BandRip user.
 */
export function registerUser(discordUserId: string): BandRipUser {
    const existingUser = findUserByDiscordId(discordUserId);

    if (existingUser) {
        return existingUser;
    }

    const now = new Date().toISOString();
    const userId = `user_${nanoid(10)}`;

    db.prepare(
        `
    INSERT INTO users (id, discord_user_id, created_at)
    VALUES (?, ?, ?)
    `,
    ).run(userId, discordUserId, now);

    return {
        id: userId,
        discordUserId,
        createdAt: now,
    };
}

/**
 * Adds the user to the current Discord guild tenant if needed.
 *
 * @param tenantId - Discord guild ID.
 * @param userId - Internal BandRip user ID.
 */
export function registerTenantUser(tenantId: string, userId: string): void {
    const now = new Date().toISOString();

    db.prepare(
        `
    INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role, created_at)
    VALUES (?, ?, 'user', ?)
    `,
    ).run(tenantId, userId, now);
}

/**
 * Registers the current Discord user and links them to the current guild.
 *
 * @param tenantId - Discord guild ID.
 * @param discordUserId - Discord user ID.
 * @returns The registered BandRip user.
 */
export function registerDiscordUserForTenant(
    tenantId: string,
    discordUserId: string,
): BandRipUser {
    const user = registerUser(discordUserId);
    registerTenantUser(tenantId, user.id);

    return user;
}

/**
 * Finds a registered BandRip user linked to a specific Discord guild tenant.
 *
 * @param tenantId - Discord guild ID.
 * @param discordUserId - Discord user ID.
 * @returns Matching tenant-scoped user, or undefined if not registered.
 */
export function findUserForTenant(
    tenantId: string,
    discordUserId: string,
): BandRipUser | undefined {
    const row = db
        .prepare(
            `
      SELECT
        users.id,
        users.discord_user_id,
        users.created_at
      FROM users
      INNER JOIN tenant_users
        ON tenant_users.user_id = users.id
      WHERE tenant_users.tenant_id = ?
        AND users.discord_user_id = ?
      `,
        )
        .get(tenantId, discordUserId);

    return row ? mapUserRow(row) : undefined;
}

/**
 * Finds a BandRip user by internal user ID.
 *
 * @param userId - Internal BandRip user ID.
 * @returns Matching user, or undefined if not found.
 */
export function findUserById(userId: string): BandRipUser | undefined {
    const row = db
        .prepare(
            `
      SELECT id, discord_user_id, created_at
      FROM users
      WHERE id = ?
      `,
        )
        .get(userId);

    return row ? mapUserRow(row) : undefined;
}