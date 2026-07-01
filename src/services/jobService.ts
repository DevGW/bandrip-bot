import { nanoid } from "nanoid";
import { db } from "../db/database.js";

/**
 * Supported input source types for rip jobs.
 */
export type JobSourceType = "url" | "attachment";

/**
 * Supported lifecycle states for rip jobs.
 */
export type JobStatus = "queued" | "running" | "complete" | "failed" | "expired";

/**
 * Represents a persisted BandRip rip job.
 */
export interface RipJob {
    id: string;
    tenantId: string;
    userId: string;
    sourceType: JobSourceType;
    sourceUrl: string | null;
    inputFilename: string | null;
    outputFilename: string | null;
    status: JobStatus;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
    expiresAt: string | null;
}

/**
 * Parameters used to create a queued rip job.
 */
export interface CreateRipJobParams {
    tenantId: string;
    userId: string;
    sourceType: JobSourceType;
    sourceUrl?: string | null;
    inputFilename?: string | null;
}

/**
 * Converts a raw SQLite row into a typed rip job.
 *
 * @param row - Raw SQLite row returned by better-sqlite3.
 * @returns Typed rip job.
 */
function mapJobRow(row: unknown): RipJob {
    const jobRow = row as {
        id: string;
        tenant_id: string;
        user_id: string;
        source_type: JobSourceType;
        source_url: string | null;
        input_filename: string | null;
        output_filename: string | null;
        status: JobStatus;
        error_message: string | null;
        created_at: string;
        completed_at: string | null;
        expires_at: string | null;
    };

    return {
        id: jobRow.id,
        tenantId: jobRow.tenant_id,
        userId: jobRow.user_id,
        sourceType: jobRow.source_type,
        sourceUrl: jobRow.source_url,
        inputFilename: jobRow.input_filename,
        outputFilename: jobRow.output_filename,
        status: jobRow.status,
        errorMessage: jobRow.error_message,
        createdAt: jobRow.created_at,
        completedAt: jobRow.completed_at,
        expiresAt: jobRow.expires_at,
    };
}

/**
 * Finds a rip job by ID.
 *
 * @param jobId - Rip job ID.
 * @returns Matching rip job, or undefined when no job exists.
 */
export function findJobById(jobId: string): RipJob | undefined {
    const row = db
        .prepare(
            `
      SELECT
        id,
        tenant_id,
        user_id,
        source_type,
        source_url,
        input_filename,
        output_filename,
        status,
        error_message,
        created_at,
        completed_at,
        expires_at
      FROM jobs
      WHERE id = ?
      `,
        )
        .get(jobId);

    return row ? mapJobRow(row) : undefined;
}

/**
 * Creates a queued rip job for later background processing.
 *
 * @param params - Rip job creation parameters.
 * @returns Newly created rip job.
 */
export function createQueuedRipJob(params: CreateRipJobParams): RipJob {
    const now = new Date().toISOString();
    const jobId = `job_${nanoid(10)}`;

    db.prepare(
        `
    INSERT INTO jobs (
      id,
      tenant_id,
      user_id,
      source_type,
      source_url,
      input_filename,
      output_filename,
      status,
      error_message,
      created_at,
      completed_at,
      expires_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'queued', NULL, ?, NULL, NULL)
    `,
    ).run(
        jobId,
        params.tenantId,
        params.userId,
        params.sourceType,
        params.sourceUrl ?? null,
        params.inputFilename ?? null,
        now,
    );

    return {
        id: jobId,
        tenantId: params.tenantId,
        userId: params.userId,
        sourceType: params.sourceType,
        sourceUrl: params.sourceUrl ?? null,
        inputFilename: params.inputFilename ?? null,
        outputFilename: null,
        status: "queued",
        errorMessage: null,
        createdAt: now,
        completedAt: null,
        expiresAt: null,
    };
}

/**
 * Atomically claims the oldest queued rip job for worker processing.
 *
 * @returns The claimed running job, or undefined when no queued job exists.
 */
export function claimNextQueuedJob(): RipJob | undefined {
    const claimTransaction = db.transaction((): RipJob | undefined => {
        const candidate = db
            .prepare(
                `
        SELECT id
        FROM jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
        `,
            )
            .get() as { id: string } | undefined;

        if (!candidate) {
            return undefined;
        }

        const result = db
            .prepare(
                `
        UPDATE jobs
        SET status = 'running'
        WHERE id = ?
          AND status = 'queued'
        `,
            )
            .run(candidate.id);

        if (result.changes === 0) {
            return undefined;
        }

        return findJobById(candidate.id);
    });

    return claimTransaction();
}

/**
 * Marks a rip job as complete.
 *
 * @param jobId - Rip job ID.
 * @param outputFilename - Produced MP3 filename.
 * @param expiresAt - ISO timestamp when the output file expires.
 */
export function markJobComplete(
    jobId: string,
    outputFilename: string,
    expiresAt: string,
): void {
    const now = new Date().toISOString();

    db.prepare(
        `
    UPDATE jobs
    SET
      status = 'complete',
      output_filename = ?,
      error_message = NULL,
      completed_at = ?,
      expires_at = ?
    WHERE id = ?
    `,
    ).run(outputFilename, now, expiresAt, jobId);
}

/**
 * Marks a rip job as failed.
 *
 * @param jobId - Rip job ID.
 * @param errorMessage - Human-readable failure reason.
 */
export function markJobFailed(jobId: string, errorMessage: string): void {
    const now = new Date().toISOString();

    db.prepare(
        `
    UPDATE jobs
    SET
      status = 'failed',
      error_message = ?,
      completed_at = ?,
      expires_at = NULL
    WHERE id = ?
    `,
    ).run(errorMessage, now, jobId);
}

/**
 * Lists recent rip jobs for one user within one tenant.
 *
 * @param tenantId - Discord guild ID.
 * @param userId - Internal BandRip user ID.
 * @param limit - Maximum number of jobs to return.
 * @returns Recent jobs scoped to the requested tenant and user.
 */
export function listJobsForUser(
    tenantId: string,
    userId: string,
    limit = 10,
): RipJob[] {
    const rows = db
        .prepare(
            `
      SELECT
        id,
        tenant_id,
        user_id,
        source_type,
        source_url,
        input_filename,
        output_filename,
        status,
        error_message,
        created_at,
        completed_at,
        expires_at
      FROM jobs
      WHERE tenant_id = ?
        AND user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
      `,
        )
        .all(tenantId, userId, limit) as unknown[];

    return rows.map(mapJobRow);
}