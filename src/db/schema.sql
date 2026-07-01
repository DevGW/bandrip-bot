CREATE TABLE IF NOT EXISTS users (
                                     id TEXT PRIMARY KEY,
                                     discord_user_id TEXT NOT NULL UNIQUE,
                                     created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_users (
                                            tenant_id TEXT NOT NULL,
                                            user_id TEXT NOT NULL,
                                            role TEXT NOT NULL DEFAULT 'user',
                                            created_at TEXT NOT NULL,
                                            PRIMARY KEY (tenant_id, user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS jobs (
                                    id TEXT PRIMARY KEY,
                                    tenant_id TEXT NOT NULL,
                                    user_id TEXT NOT NULL,
                                    source_type TEXT NOT NULL,
                                    source_url TEXT,
                                    input_filename TEXT,
                                    output_filename TEXT,
                                    status TEXT NOT NULL,
                                    error_message TEXT,
                                    created_at TEXT NOT NULL,
                                    completed_at TEXT,
                                    expires_at TEXT,
                                    FOREIGN KEY (user_id) REFERENCES users(id)
    );