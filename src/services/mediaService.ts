import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { RipJob } from "./jobService.js";

/**
 * Result returned after a rip job is processed.
 */
export interface ProcessedMediaResult {
    outputFilename: string;
    downloadFilename: string;
}

/**
 * Gets the configured FFmpeg executable path.
 *
 * @returns FFmpeg executable path.
 */
function getFfmpegPath(): string {
    return process.env.FFMPEG_PATH ?? "ffmpeg";
}

/**
 * Gets the configured yt-dlp executable path.
 *
 * @returns yt-dlp executable path.
 */
function getYtDlpPath(): string {
    return process.env.YT_DLP_PATH ?? "yt-dlp";
}

/**
 * Runs an external command and rejects when the command exits unsuccessfully.
 *
 * @param command - Command executable path or name.
 * @param args - Command arguments.
 * @returns Resolves when the command exits with code 0.
 */
function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stderr = "";

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();

            if (stderr.length > 10_000) {
                stderr = stderr.slice(-10_000);
            }
        });

        child.on("error", (error) => {
            reject(error);
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `${command} exited with code ${code ?? "unknown"}: ${stderr.trim()}`,
                ),
            );
        });
    });
}

/**
 * Runs an external command and returns stdout.
 *
 * @param command - Command executable path or name.
 * @param args - Command arguments.
 * @returns Captured stdout.
 */
function runCommandWithOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();

            if (stdout.length > 10_000) {
                stdout = stdout.slice(-10_000);
            }
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();

            if (stderr.length > 10_000) {
                stderr = stderr.slice(-10_000);
            }
        });

        child.on("error", (error) => {
            reject(error);
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve(stdout.trim());
                return;
            }

            reject(
                new Error(
                    `${command} exited with code ${code ?? "unknown"}: ${stderr.trim()}`,
                ),
            );
        });
    });
}

/**
 * Ensures a directory exists.
 *
 * @param directoryPath - Directory path to create if missing.
 */
async function ensureDirectory(directoryPath: string): Promise<void> {
    await fs.mkdir(directoryPath, { recursive: true });
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
 * Creates a filesystem-safe filename segment.
 *
 * @param value - Raw filename value.
 * @returns Sanitized filename segment.
 */
function sanitizeFilename(value: string): string {
    const sanitized = value
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

    if (sanitized.length === 0) {
        return "bandrip";
    }

    return sanitized.slice(0, 160);
}

/**
 * Creates an MP3 filename from a source label.
 *
 * @param value - Raw source label.
 * @returns Safe MP3 filename.
 */
function createMp3Filename(value: string): string {
    const parsed = path.parse(value);
    const baseName = parsed.name || value;
    const safeBaseName = sanitizeFilename(baseName);

    return `${safeBaseName}.mp3`;
}

/**
 * Reads a media title from yt-dlp.
 *
 * @param sourceUrl - Permissioned media URL.
 * @returns Media title when available.
 */
async function getUrlTitle(sourceUrl: string): Promise<string> {
    const title = await runCommandWithOutput(getYtDlpPath(), [
        "--no-playlist",
        "--skip-download",
        "--print",
        "title",
        sourceUrl,
    ]);

    return title.split("\n")[0]?.trim() || "bandrip";
}

/**
 * Downloads a Discord attachment URL to the local input directory.
 *
 * @param sourceUrl - Discord attachment download URL.
 * @param inputFilename - Original attachment filename.
 * @param inputDirectory - Local input directory.
 * @param jobId - Rip job ID.
 * @returns Local downloaded file path.
 */
async function downloadAttachmentToInputFile(
    sourceUrl: string,
    inputFilename: string,
    inputDirectory: string,
    jobId: string,
): Promise<string> {
    const safeFilename = sanitizeFilename(inputFilename);
    const inputPath = path.join(inputDirectory, `${jobId}_${safeFilename}`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
        throw new Error(`Failed to download attachment: HTTP ${response.status}`);
    }

    const fileBuffer = Buffer.from(await response.arrayBuffer());

    await fs.writeFile(inputPath, fileBuffer);

    return inputPath;
}

/**
 * Downloads media from a URL using yt-dlp into the local input directory.
 *
 * @param sourceUrl - Permissioned media URL.
 * @param inputDirectory - Local input directory.
 * @param jobId - Rip job ID.
 * @returns Local downloaded media file path.
 */
async function downloadUrlToInputFile(
    sourceUrl: string,
    inputDirectory: string,
    jobId: string,
): Promise<string> {
    const outputTemplate = path.join(inputDirectory, `${jobId}.%(ext)s`);

    await runCommand(getYtDlpPath(), [
        "--no-playlist",
        "-f",
        "bestaudio/best",
        "-o",
        outputTemplate,
        sourceUrl,
    ]);

    const files = await fs.readdir(inputDirectory);
    const downloadedFile = files.find((file) => file.startsWith(`${jobId}.`));

    if (!downloadedFile) {
        throw new Error("yt-dlp completed but no downloaded input file was found.");
    }

    return path.join(inputDirectory, downloadedFile);
}

/**
 * Converts an input media file to MP3 using FFmpeg.
 *
 * @param inputPath - Local input media path.
 * @param outputPath - Local output MP3 path.
 */
async function convertInputToMp3(
    inputPath: string,
    outputPath: string,
): Promise<void> {
    await runCommand(getFfmpegPath(), [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2",
        outputPath,
    ]);
}

/**
 * Determines the user-facing MP3 filename for a rip job.
 *
 * @param job - Claimed rip job.
 * @returns Safe user-facing MP3 filename.
 */
async function getDownloadFilename(job: RipJob): Promise<string> {
    if (job.sourceType === "attachment") {
        return createMp3Filename(job.inputFilename ?? job.id);
    }

    if (!job.sourceUrl) {
        return `${job.id}.mp3`;
    }

    const title = await getUrlTitle(job.sourceUrl);

    return createMp3Filename(title);
}

/**
 * Processes a queued rip job into an MP3 artifact.
 *
 * Input files are deleted after conversion. Output files are retained until
 * expiration/cleanup support is added.
 *
 * @param job - Claimed rip job.
 * @returns Produced output metadata.
 */
export async function processRipJob(job: RipJob): Promise<ProcessedMediaResult> {
    const inputDirectory = process.env.TMP_INPUT_DIR ?? "./tmp/input";
    const outputDirectory = process.env.TMP_OUTPUT_DIR ?? "./tmp/output";

    await ensureDirectory(inputDirectory);
    await ensureDirectory(outputDirectory);

    if (!job.sourceUrl) {
        throw new Error("Job does not have a source URL.");
    }

    const outputFilename = `${job.id}.mp3`;
    const outputPath = path.join(outputDirectory, outputFilename);
    const downloadFilename = await getDownloadFilename(job);

    let inputPath: string | undefined;

    try {
        if (job.sourceType === "attachment") {
            inputPath = await downloadAttachmentToInputFile(
                job.sourceUrl,
                job.inputFilename ?? `${job.id}.video`,
                inputDirectory,
                job.id,
            );
        } else {
            inputPath = await downloadUrlToInputFile(
                job.sourceUrl,
                inputDirectory,
                job.id,
            );
        }

        await convertInputToMp3(inputPath, outputPath);

        return {
            outputFilename,
            downloadFilename,
        };
    } finally {
        if (inputPath) {
            await removeFileIfExists(inputPath);
        }
    }
}