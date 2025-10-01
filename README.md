# Bokuyaba Downloader Discord Bot

A Discord bot that downloads and unscrambles images from Bokuyaba comic viewer URLs using your existing `bokuyabadownloader-url.js` script.

## Features

- **Slash Command Interface**: Simple `/download` command to process URLs
- **Automatic Image Processing**: Downloads and unscrambles images using your existing script
- **Batch File Handling**: Automatically handles multiple images and sends them in batches
- **File Size Management**: Skips files that are too large for Discord
- **Temporary File Cleanup**: Automatically cleans up downloaded files after sending

## Prerequisites

- Node.js (version 16 or higher recommended)
- FFmpeg installed and available in system PATH
- Discord Bot Token
- The original `bokuyabadownloader-url.js` script

## Installation

1. **Clone or download this project**
   ```bash
   cd bokuyabadownloader-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Discord bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```

4. **Verify script path**
   Make sure the path to your `bokuyabadownloader-url.js` script is correct in `bot.js` (line 17):
   ```javascript
   const SCRIPT_PATH = 'C:\\\\Users\\\\ptand\\\\OneDrive\\\\Documents\\\\code\\\\bokuyabadownloader-url.js';
   ```

## Discord Bot Setup

1. **Create a Discord Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Go to the "Bot" section and create a bot
   - Copy the bot token and add it to your `.env` file

2. **Set Bot Permissions**
   Your bot needs the following permissions:
   - Send Messages
   - Use Slash Commands
   - Attach Files
   - Embed Links

3. **Invite Bot to Server**
   - Go to the "OAuth2" → "URL Generator" section
   - Select "bot" and "applications.commands" scopes
   - Select the required permissions
   - Use the generated URL to invite the bot to your server

## Usage

1. **Start the bot**
   ```bash
   node bot.js
   ```

2. **Use the slash command in Discord**
   ```
   /download url:https://championcross.jp/viewer/...
   ```

## How It Works

1. The bot receives a URL through the `/download` slash command
2. It validates that the URL is from championcross.jp
3. Creates a temporary directory for downloaded files
4. Runs your `bokuyabadownloader-url.js` script with the provided URL
5. Collects the resulting PNG images from the temp directory
6. Sends the images to Discord in batches (max 10 files per message)
7. Cleans up temporary files after sending

## File Structure

```
bokuyabadownloader-bot/
├── bot.js              # Main bot file
├── package.json        # Node.js dependencies
├── .env.example        # Environment variables template
├── .env                # Your environment variables (not in git)
├── .gitignore          # Git ignore file
├── temp/               # Temporary directory for downloads
└── README.md           # This file
```

## Troubleshooting

### Common Issues

1. **"Process exited with code 1" error**
   - Make sure FFmpeg is installed and in your PATH
   - Verify the URL is valid and accessible
   - Check that the original script works independently

2. **Bot doesn't respond to slash commands**
   - Make sure the bot has the "applications.commands" scope
   - Wait a few minutes for Discord to register the commands
   - Check the bot has permission to send messages in the channel

3. **Files too large to send**
   - The bot automatically skips files larger than 8MB
   - Discord has a 25MB total limit per message

### Node.js Version Warning

If you see engine warnings during installation, consider updating to Node.js 18+ for better compatibility with Discord.js v14.

## Dependencies

- **discord.js**: Discord API library
- **dotenv**: Environment variable management
- **jsdom**: Required by your bokuyabadownloader script

## License

This project is provided as-is for personal use.