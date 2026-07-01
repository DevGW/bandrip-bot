import fs from "node:fs/promises";
import path from "node:path";
import {
    listExpiredCompletedJobs,
    markJobExpired,
} from "./jobService.js";

/**
 * Configuration for the output cleanup loop.
 */
export interface CleanupServiceOptions {
    pollIntervalMs: number;
    batchSize: number;
}

/**
 * Converts an unknown error into a readable log message.
 *
 * @param error - Unknown caught error.
 * @returns Human-readable error message.
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown cleanup error.";
}

/**
 * Removes a file if it exists.
 *
 * @param filePath - File path to remove.
 */
async function removeFileIfExists(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch (error: unknown) {
        const nodeError = error as NodeJS.ErrnoException;

        if (nodeError.code !== "ENOENT") {
            throw error;
        }
    }
}

/**
 * Resolves an output filename to a safe path inside the configured output directory.
 *
 * @param outputFilename - Stored output filename.
 * @returns Safe absolute output path.
 * @throws Error when the filename resolves outside the output directory.
 */
function resolveOutputPath(outputFilename: string): string {
    const outputDirectory = process.env.TMP_OUTPUT_DIR ?? "./tmp/output";
    const resolvedDirectory = path.resolve(outputDirectory);
    const resolvedPath = path.resolve(resolvedDirectory, outputFilename);

    if (!resolvedPath.startsWith(`${resolvedDirectory}${path.sep}`)) {
        throw new Error(`Unsafe output filename: ${outputFilename}`);
    }

    return resolvedPath;
}

/**
 * Processes one batch of expired completed jobs.
 *
 * Expired output files are deleted and the corresponding jobs are marked expired.
 *
 * @param batchSize - Maximum number of expired jobs to clean in one pass.
 */
async function cleanupExpiredOutputs(batchSize: number): Promise<void> {
    const nowIso = new Date().toISOString();
    const expiredJobs = listExpiredCompletedJobs(nowIso, batchSize);

    if (expiredJobs.length === 0) {
        return;
    }

    for (const job of expiredJobs) {
        try {
            if (job.outputFilename) {
                const outputPath = resolveOutputPath(job.outputFilename);
                await removeFileIfExists(outputPath);
            }

            markJobExpired(job.id);

            console.log(`Expired rip job output: ${job.id}`);
        } catch (error: unknown) {
            console.error(
                `Failed cleanup for rip job ${job.id}:`,
                getErrorMessage(error),
            );
        }
    }
}

/**
 * Starts the output cleanup polling loop.
 *
 * @param options - Cleanup service options.
 */
export function startCleanupService(options: CleanupServiceOptions): void {
    let isRunning = false;

    const runCleanup = (): void => {
        if (isRunning) {
            return;
        }

        isRunning = true;

        void cleanupExpiredOutputs(options.batchSize).finally(() => {
            isRunning = false;
        });
    };

    runCleanup();

    setInterval(runCleanup, options.pollIntervalMs);

    console.log(
        `BandRip cleanup started. Poll interval: ${options.pollIntervalMs}ms`,
    );
}