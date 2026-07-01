# BandRip Bot

BandRip is a Discord bot that extracts MP3 audio from uploaded video files or supported media URLs.

Users run slash commands in a Discord server, BandRip processes the request in the background, and the completed MP3 is delivered by direct message.

## Features

- Discord slash-command interface
- Per-user registration
- Server-scoped user history
- MP3 extraction from uploaded video files within Discord upload limits
- MP3 extraction from supported media URLs through `yt-dlp`
- Background job processing
- SQLite-backed job history
- Direct-message delivery of completed MP3 files
- Temporary input file handling
- Original filename preservation for uploaded files
- Media title-based filenames for URL jobs when available
- Bundled FFmpeg binary through `ffmpeg-static`

## Supported Commands

### `/register`

Registers your Discord user with BandRip in the current server.

```text
/register
```

### `/rip`

Queues a media file or URL for MP3 extraction.

Upload a video file:

```text
/rip file:<uploaded-video>
```

Supported upload extensions:

```text
.mp4
.mov
.webm
.mkv
```

Discord enforces upload limits before BandRip receives an attachment. For non-Nitro users, the default Discord upload limit is 10 MB. Nitro users, boosted servers, and some experimental Discord accounts may have higher limits.

If Discord rejects the upload, BandRip cannot process the file because the attachment never reaches the bot.

For larger files, use a supported direct-download URL instead:

```text
/rip url:<direct-download-url>
```

or compress/trim the video before uploading.

Use a supported media URL:

```text
/rip url:<media-url>
```

URL ingestion should be used only with user-owned, licensed, or otherwise permissioned media.

For uploaded files, the returned MP3 keeps the original base filename.

```text
local-band-clip.mov → local-band-clip.mp3
```

For URL jobs, BandRip attempts to use the media title as the MP3 filename.

```text
https://youtu.be/example → Video Title.mp3
```

URL ingestion should be used only with user-owned, licensed, or otherwise permissioned media.

### `/history`

Shows your recent BandRip jobs in the current server.

```text
/history
```

History is scoped to the current Discord user and server.

## How It Works

```text
Discord slash command
        ↓
Validate user and input
        ↓
Create queued job in SQLite
        ↓
Background worker claims queued job
        ↓
Download or resolve media input
        ↓
Convert audio to MP3
        ↓
Mark job complete or failed
        ↓
Send MP3 to user by Discord DM
```

## Tech Stack

- Node.js
- TypeScript
- discord.js
- SQLite
- better-sqlite3
- ffmpeg-static
- yt-dlp
- dotenv
- nanoid

## Requirements

Install the following before running BandRip:

```bash
node -v
npm -v
yt-dlp --version
```

On macOS with Homebrew:

```bash
brew install yt-dlp
```

FFmpeg is provided by the `ffmpeg-static` npm package. You only need to set `FFMPEG_PATH` if you want to override the bundled binary with a system-installed FFmpeg.

## Installation

Clone the repository:

```bash
git clone https://github.com/DevGW/bandrip-bot.git
cd bandrip-bot
```

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the required Discord values in `.env`.

## Environment Variables

Example `.env`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

DATABASE_PATH=./data/bandrip.sqlite

TMP_INPUT_DIR=./tmp/input
TMP_OUTPUT_DIR=./tmp/output
OUTPUT_TTL_MINUTES=60

# Optional. BandRip uses ffmpeg-static when FFMPEG_PATH is not set.
FFMPEG_PATH=

# Optional if yt-dlp is already available on PATH.
YT_DLP_PATH=/opt/homebrew/bin/yt-dlp
```

### Values

| Variable | Required | Description |
|---|---:|---|
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Discord application/client ID |
| `DISCORD_GUILD_ID` | Yes | Discord server ID used for guild command registration |
| `DATABASE_PATH` | No | SQLite database path. Defaults to `./data/bandrip.sqlite` |
| `TMP_INPUT_DIR` | No | Temporary input directory. Defaults to `./tmp/input` |
| `TMP_OUTPUT_DIR` | No | Temporary output directory. Defaults to `./tmp/output` |
| `OUTPUT_TTL_MINUTES` | No | Number of minutes used when calculating the job output expiration timestamp |
| `FFMPEG_PATH` | No | Optional override path for FFmpeg |
| `YT_DLP_PATH` | No | Optional override path for yt-dlp |

Do not commit `.env`.

## Discord Setup

1. Create an application in the Discord Developer Portal.
2. Add a bot to the application.
3. Copy the bot token into `.env`.
4. Enable guild installation.
5. Use the OAuth2 URL Generator with these scopes:

```text
bot
applications.commands
```

Recommended bot permissions:

```text
View Channels
Send Messages
Embed Links
Attach Files
Use Slash Commands
```

Privileged gateway intents are not required because BandRip uses slash commands instead of reading normal message content.

## Register Slash Commands

Run this after creating or changing command definitions:

```bash
npm run commands:deploy
```

This registers the commands to the server configured by `DISCORD_GUILD_ID`.

You do not need to run this for ordinary backend code changes.

## Running the Bot

Start the bot:

```bash
npm run dev
```

Expected output:

```text
BandRip connected as BandRip#8814
BandRip worker started. Poll interval: 2000ms
```

## Build

Compile TypeScript:

```bash
npm run build
```

## Project Structure

```text
bandrip-bot/
  src/
    bot.ts
    registerCommands.ts

    commands/
      command.ts
      index.ts
      register.ts
      rip.ts
      history.ts

    db/
      database.ts
      schema.sql

    services/
      configService.ts
      userService.ts
      jobService.ts
      mediaService.ts

    workers/
      ripWorker.ts

  data/
    bandrip.sqlite

  tmp/
    input/
    output/

  .env.example
  .gitignore
  package.json
  package-lock.json
  tsconfig.json
  README.md
```

## Job States

BandRip jobs use these states:

```text
queued
running
complete
failed
expired
```

Current processing flow:

```text
queued → running → complete
queued → running → failed
```

Completed jobs are marked `expired` after their output file reaches `expires_at` and the cleanup service removes the local MP3 artifact.

## File Handling

Input files are stored temporarily in:

```text
tmp/input/
```

Output MP3 files are written to:

```text
tmp/output/
```

Input files are deleted after processing. Output files are retained locally and sent to the requesting user by Discord DM.

`OUTPUT_TTL_MINUTES` controls how long completed MP3 files remain in `tmp/output/` before the cleanup service removes them and marks the job as `expired`.

## SQLite

The default database path is:

```text
data/bandrip.sqlite
```

Useful inspection commands:

```bash
sqlite3 data/bandrip.sqlite '.tables'
```

```bash
sqlite3 data/bandrip.sqlite 'select id, source_type, status, output_filename, error_message from jobs order by created_at desc limit 10;'
```

```bash
sqlite3 data/bandrip.sqlite 'select * from users;'
```

```bash
sqlite3 data/bandrip.sqlite 'select * from tenant_users;'
```

## Usage Example

Start the bot:

```bash
npm run dev
```

In Discord:

```text
/register
```

Then upload a video:

```text
/rip file:<uploaded-video>
```

BandRip will process the job and send the MP3 by DM.

Check history:

```text
/history
```

## Notes

Discord upload limits apply before BandRip receives uploaded files. For non-Nitro users, the default upload limit is 10 MB. Larger files should be provided through `/rip url:<direct-download-url>`, compressed, trimmed, or uploaded from an account/server with a higher Discord upload limit.

Discord upload limits can also affect DM delivery of completed MP3 files. If the generated MP3 exceeds Discord's allowed attachment size, processing may succeed but delivery may fail.

URL processing depends on `yt-dlp` and the source provider. Some URLs may fail if the provider blocks download access or if `yt-dlp` needs to be updated.

Update `yt-dlp` with Homebrew:

```bash
brew update
brew upgrade yt-dlp
yt-dlp --version
```

Uploaded video files under the user's Discord upload limit are the most reliable processing path.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the bot with `tsx` |
| `npm run build` | Compiles TypeScript |
| `npm run commands:deploy` | Registers slash commands to the configured Discord server |