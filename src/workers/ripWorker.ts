import path from "node:path";
import { AttachmentBuilder } from "discord.js";
import type { Client } from "discord.js";
import {
    claimNextQueuedJob,
    markJobComplete,
    markJobFailed,
} from "../services/jobService.js";
import type { RipJob } from "../services/jobService.js";
import type { ProcessedMediaResult } from "../services/mediaService.js";
import { processRipJob } from "../services/mediaService.js";
import { findUserById } from "../services/userService.js";

/**
 * Configuration for the BandRip worker loop.
 */
export interface RipWorkerOptions {
    pollIntervalMs: number;
    outputTtlMinutes: number;
}

/**
 * Calculates the expiration timestamp for a completed output file.
 *
 * @param ttlMinutes - Number of minutes the output should remain available.
 * @returns ISO expiration timestamp.
 */
function calculateExpiresAt(ttlMinutes: number): string {
    return new Date(Date.now() + ttlMinutes * 60_000).toISOString();
}

/**
 * Converts an unknown error into a safe message for job storage.
 *
 * @param error - Unknown caught error.
 * @returns Human-readable error message.
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message.slice(0, 1000);
    }

    return "Unknown worker error.";
}

/**
 * Sends a completed MP3 result to the Discord user who created the job.
 *
 * DM delivery is best-effort. A failed DM does not fail the completed rip job.
 *
 * @param client - Ready Discord client.
 * @param job - Completed rip job.
 * @param result - Processed media result.
 */
async function sendResultDm(
    client: Client,
    job: RipJob,
    result: ProcessedMediaResult,
): Promise<void> {
    const user = findUserById(job.userId);

    if (!user) {
        console.warn(`Could not DM result for ${job.id}: user not found.`);
        return;
    }

    const outputDirectory = process.env.TMP_OUTPUT_DIR ?? "./tmp/output";
    const outputPath = path.join(outputDirectory, result.outputFilename);

    const discordUser = await client.users.fetch(user.discordUserId);
    const attachment = new AttachmentBuilder(outputPath, {
        name: result.downloadFilename,
    });

    await discordUser.send({
        content: `BandRip completed ${job.id}.`,
        files: [attachment],
    });
}

/**
 * Processes one queued rip job if one exists.
 *
 * @param client - Ready Discord client.
 * @param outputTtlMinutes - Number of minutes completed output remains available.
 */
async function processNextJob(
    client: Client,
    outputTtlMinutes: number,
): Promise<void> {
    const job = claimNextQueuedJob();

    if (!job) {
        return;
    }

    console.log(`Processing rip job: ${job.id}`);

    try {
        const result = await processRipJob(job);
        const expiresAt = calculateExpiresAt(outputTtlMinutes);

        markJobComplete(job.id, result.outputFilename, expiresAt);

        console.log(`Completed rip job: ${job.id}`);

        try {
            await sendResultDm(client, job, result);
            console.log(`DM sent for rip job: ${job.id}`);
        } catch (error: unknown) {
            console.error(`DM failed for rip job: ${job.id}`, getErrorMessage(error));
        }
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);

        markJobFailed(job.id, errorMessage);

        console.error(`Failed rip job: ${job.id}`, errorMessage);
    }
}

/**
 * Starts the single-job BandRip polling worker.
 *
 * The MVP worker intentionally processes one job at a time.
 *
 * @param client - Ready Discord client.
 * @param options - Worker loop options.
 */
export function startRipWorker(client: Client, options: RipWorkerOptions): void {
    let isPolling = false;

    setInterval(() => {
        if (isPolling) {
            return;
        }

        isPolling = true;

        void processNextJob(client, options.outputTtlMinutes).finally(() => {
            isPolling = false;
        });
    }, options.pollIntervalMs);

    console.log(
        `BandRip worker started. Poll interval: ${options.pollIntervalMs}ms`,
    );
}