require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Path to the bokuyabadownloader script
const SCRIPT_PATH = 'C:\\Users\\ptand\\OneDrive\\Documents\\code\\bokuyabadownloader-url.js';

// Function to run the bokuyabadownloader script
async function runBokuyabaDownloader(url) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [SCRIPT_PATH, url], {
            cwd: './temp', // Run in temp directory to contain downloaded files
            stdio: 'pipe'
        });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Process exited with code ${code}. Error: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            reject(error);
        });
    });
}

// Function to get downloaded image files
function getDownloadedImages(tempDir) {
    try {
        const files = fs.readdirSync(tempDir);
        return files.filter(file => file.endsWith('.png') && /^\d+\.png$/.test(file))
                   .sort((a, b) => {
                       const numA = parseInt(a.split('.')[0]);
                       const numB = parseInt(b.split('.')[0]);
                       return numA - numB;
                   });
    } catch (error) {
        console.error('Error reading temp directory:', error);
        return [];
    }
}

// Function to clean up temporary files
function cleanupTempFiles(tempDir) {
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        console.log('Cleaned up temporary files');
    } catch (error) {
        console.error('Error cleaning up temp files:', error);
    }
}

// When the client is ready, run this code (only once)
client.once('ready', async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Create temp directory if it doesn't exist
    if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp');
    }
    
    // Register slash commands
    const commands = [
        new SlashCommandBuilder()
            .setName('download')
            .setDescription('Download images from a bokuyaba viewer URL')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('The viewer URL to download from')
                    .setRequired(true)
            )
    ];
    
    try {
        console.log('Started refreshing application (/) commands.');
        await client.application.commands.set(commands);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error refreshing commands:', error);
    }
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'download') {
        const url = interaction.options.getString('url');
        
        // Validate URL format (basic check)
        if (!url.includes('championcross.jp')) {
            await interaction.reply('❌ Please provide a valid championcross.jp viewer URL.');
            return;
        }
        
        // Defer the reply since this will take time
        await interaction.deferReply();
        
        const tempDir = './temp';
        
        try {
            // Clean up any existing files in temp directory
            cleanupTempFiles(tempDir);
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📥 Starting Download')
                .setDescription(`Processing URL: ${url}`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Run the bokuyabadownloader script
            console.log(`Running script for URL: ${url}`);
            const result = await runBokuyabaDownloader(url);
            
            // Get the downloaded images
            const imageFiles = getDownloadedImages(tempDir);
            
            if (imageFiles.length === 0) {
                await interaction.editReply('❌ No images were downloaded. Please check the URL and try again.');
                return;
            }
            
            // Discord has a limit of 10 files per message and 25MB total
            // We'll send images in batches if needed
            const maxFilesPerMessage = 10;
            const maxFileSizeMB = 8; // Conservative limit per file
            
            let currentBatch = [];
            let batchNumber = 1;
            
            for (const imageFile of imageFiles) {
                const filePath = path.join(tempDir, imageFile);
                const stats = fs.statSync(filePath);
                const fileSizeMB = stats.size / (1024 * 1024);
                
                if (fileSizeMB > maxFileSizeMB) {
                    console.log(`Skipping ${imageFile} - file too large (${fileSizeMB.toFixed(2)}MB)`);
                    continue;
                }
                
                currentBatch.push(imageFile);
                
                // Send batch when we reach the limit or it's the last file
                if (currentBatch.length === maxFilesPerMessage || imageFile === imageFiles[imageFiles.length - 1]) {
                    const attachments = currentBatch.map(fileName => 
                        new AttachmentBuilder(path.join(tempDir, fileName))
                    );
                    
                    const batchEmbed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(`✅ Download Complete ${imageFiles.length > maxFilesPerMessage ? `(Batch ${batchNumber})` : ''}`)
                        .setDescription(`Successfully downloaded ${currentBatch.length} image(s)`)
                        .setFooter({ text: `Total images: ${imageFiles.length}` })
                        .setTimestamp();
                    
                    if (batchNumber === 1) {
                        await interaction.editReply({ 
                            embeds: [batchEmbed], 
                            files: attachments 
                        });
                    } else {
                        await interaction.followUp({ 
                            embeds: [batchEmbed], 
                            files: attachments 
                        });
                    }
                    
                    currentBatch = [];
                    batchNumber++;
                }
            }
            
        } catch (error) {
            console.error('Error processing request:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Download Failed')
                .setDescription(`An error occurred: ${error.message}`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
        } finally {
            // Clean up temporary files after a delay
            setTimeout(() => {
                cleanupTempFiles(tempDir);
            }, 5000);
        }
    }
});

// Handle errors
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);