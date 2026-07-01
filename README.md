# BandRip Bot

BandRip is a Discord bot that extracts MP3 audio from uploaded video files or supported media URLs.

Users run slash commands in a Discord server, BandRip processes the request in the background, and the completed MP3 is delivered by direct message.

## Features

- Discord slash-command interface
- Per-user registration
- Server-scoped user history
- MP3 extraction from uploaded video files
- MP3 extraction from supported media URLs through `yt-dlp`
- Background job processing
- SQLite-backed job history
- Direct-message delivery of completed MP3 files
- Temporary input file handling
- Original filename preservation for uploaded files
- Media title-based filenames for URL jobs when available

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

Use a supported media URL:

```text
/rip url:<media-url>
```

Supported upload extensions:

```text
.mp4
.mov
.webm
.mkv
```

For uploaded files, the returned MP3 keeps the original base filename.

```text
local-band-clip.mov → local-band-clip.mp3
```

For URL jobs, BandRip attempts to use the media title as the MP3 filename.

```text
https://youtu.be/example → Video Title.mp3
```

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
Convert audio to MP3 with FFmpeg
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
- FFmpeg
- yt-dlp
- dotenv
- nanoid

## Requirements

Install the following before running BandRip:

```bash
node -v
npm -v
ffmpeg -version
yt-dlp --version
```

On macOS with Homebrew:

```bash
brew install ffmpeg yt-dlp
```

## Installation

Clone the repository:

```bash
git clone <repo-url>
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

Fill in the required values in `.env`.

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

FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
YT_DLP_PATH=/opt/homebrew/bin/yt-dlp
```

### Required Values

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Discord application/client ID |
| `DISCORD_GUILD_ID` | Discord server ID used for guild command registration |
| `DATABASE_PATH` | SQLite database path |
| `TMP_INPUT_DIR` | Temporary input directory |
| `TMP_OUTPUT_DIR` | Temporary output directory |
| `OUTPUT_TTL_MINUTES` | Output expiration time in minutes |
| `FFMPEG_PATH` | Path to the FFmpeg executable |
| `YT_DLP_PATH` | Path to the yt-dlp executable |

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
  package.json
  tsconfig.json
  README.md
```

## Job States

BandRip jobs use the following states:

```text
queued
running
complete
failed
expired
```

Current flow:

```text
queued → running → complete
queued → running → failed
```

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

URL processing depends on `yt-dlp` and the source provider. Some URLs may fail if the provider blocks download access or if `yt-dlp` needs to be updated.

Update `yt-dlp` with Homebrew:

```bash
brew update
brew upgrade yt-dlp
yt-dlp --version
```

Uploaded video files are the most reliable processing path.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts the bot with `tsx` |
| `npm run build` | Compiles TypeScript |
| `npm run commands:deploy` | Registers slash commands to the configured Discord server |
