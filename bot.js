require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ThreadAutoArchiveDuration } = require('discord.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const downloader = require("./bokuyabadownloader-url");

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// Function to get downloaded image files
function getDownloadedImages(title) {
    try {
        const files = fs.readdirSync(title);
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
            .setName('downloadyabachapter')
            .setDescription('Download images from a Championcross BokuYaba/OneYaba chapter URL')
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
    
    if (interaction.commandName === 'downloadyabachapter') {
        const url = interaction.options.getString('url');
        
        // Validate URL format (basic check)
        if (!url.includes('championcross.jp')) {
            await interaction.reply('❌ Please provide a valid championcross.jp viewer URL.');
            return;
        }
        
        // Defer the reply since this will take time
        await interaction.deferReply();
        
        
        try {
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📥 Starting Download')
                .setDescription(`Processing URL: ${url}`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
            
            // Download files
            const title = await downloader.GetChapterTitle(url);

            
            const gid = interaction.guildId;
            const guild = await client.guilds.fetch(gid);
            const channel = await guild.channels.cache.find(channel => channel.name === 'raw-dumps');
            
            if(channel.threads.cache.find(x => x.name === title)) //if the thread already exists just point them to it
            {
                var t = channel.threads.cache.find(x => x.name === title);
                var Embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(`Chapter already downloaded`)
                    .setDescription(`${title} is posted at <#${t.id}>`)
                    .setTimestamp();
                await interaction.editReply({ 
                            embeds: [Embed]
                        });
                return;
            }

            await downloader.DownloadChapter(url);

            const thread = await channel.threads.create({
                name: title,
                ThreadAutoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
            });
            
            const tempDir = `./${title}`;
            // Get the downloaded images
            const imageFiles = getDownloadedImages(tempDir);
            
            if (imageFiles.length === 0) {
                await interaction.editReply('❌ No images were downloaded. Please check the URL and try again.');
                return;
            }
            
            // Discord has a limit of 10 files per message and 25MB total
            // We'll send images in batches if needed
            const maxFilesPerMessage = 8;
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
                    await thread.send({ content: `${title} batch ${batchNumber}`, files: attachments});
                    
                    currentBatch = [];
                    batchNumber++;
                }

            }
                //update embed to point to thread
                var Embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(`✅ Download Complete`)
                    .setDescription(`Successfully downloaded ${imageFiles.length} image(s) in ${title} and posted to <#${thread.id}>`)
                    .setFooter({ text: `Total images: ${imageFiles.length}` })
                    .setTimestamp();
                await interaction.editReply({ 
                            embeds: [Embed]
                        });
                thread.setLocked(true);

                //clean up files
                downloader.DeleteChapter(title);

            
        } catch (error) {
            console.error('Error processing request:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Download Failed')
                .setDescription(`An error occurred: ${error.message}`)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed] });
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