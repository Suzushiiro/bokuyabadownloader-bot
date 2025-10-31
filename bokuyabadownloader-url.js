

const ffmpegStatic = require('ffmpeg-static');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { JSDOM } = require('jsdom');

module.exports = { DownloadChapter, DeleteChapter, GetChapterTitle }

var title = "";

const headers = {
    'Referer': 'https://championcross.jp'
};



// Helper function to make HTTP requests
function makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const module = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers
        };

        const req = module.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

// Helper function to download binary data
function downloadFile(url, filename, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const module = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers
        };

        const req = module.request(options, (res) => {
            const fileStream = fs.createWriteStream(filename);
            
            res.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            
            fileStream.on('error', (err) => {
                reject(err);
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.end();
    });
}

// Helper function to run ffmpeg commands
function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegStatic, args);
        
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg exited with code ${code}`));
            }
        });
        
        ffmpeg.on('error', (err) => {
            reject(err);
        });
    });
}

async function unscramble_page(page)
{
    const i = page.sort;
    const scramble = JSON.parse(page.scramble);
            if (scramble.length !== 16) {
                throw new Error('Scramble array is not 16 elements');
            }

            console.log(`Downloading image ${i}...`);

            const img = `${title}/${i}-scrambled.jpg`;
            await downloadFile(page.imageUrl, img, headers);

            console.log(`Unscrambling ${i}...`);

            const width = page.width;
            const height = page.height;

            const chunkWidth = Math.floor(width / 4);
            const chunkHeight = Math.floor(height / 4);

            let chunk = 0;

            for (const s of scramble) {
                if (s < 0 || s > 16) {
                    throw new Error('Bad scramble data');
                }

                const x = Math.floor(s / 4);
                const y = s % 4;

                const offset = (chunk % 4) * 4 + Math.floor(chunk / 4);

                await runFFmpeg([
                    '-y', '-i', img, '-vf', 
                    `crop=${chunkWidth}:${chunkHeight}:${x * chunkWidth}:${y * chunkHeight}`,
                    `${img}.${offset}.png`
                ]);

                chunk++;
            }

            const outcmd = [
                '-y',
                '-i', `${img}.0.png`,
                '-i', `${img}.1.png`,
                '-i', `${img}.2.png`,
                '-i', `${img}.3.png`,
                '-i', `${img}.4.png`,
                '-i', `${img}.5.png`,
                '-i', `${img}.6.png`,
                '-i', `${img}.7.png`,
                '-i', `${img}.8.png`,
                '-i', `${img}.9.png`,
                '-i', `${img}.10.png`,
                '-i', `${img}.11.png`,
                '-i', `${img}.12.png`,
                '-i', `${img}.13.png`,
                '-i', `${img}.14.png`,
                '-i', `${img}.15.png`,
                '-filter_complex',
                '[0][1][2][3]hstack=inputs=4[row0];' +
                '[4][5][6][7]hstack=inputs=4[row1];' +
                '[8][9][10][11]hstack=inputs=4[row2];' +
                '[12][13][14][15]hstack=inputs=4[row3];' +
                '[row0][row1][row2][row3]vstack=inputs=4[out]',
                '-map', '[out]', `${title}/${i}.png`
            ];

            await runFFmpeg(outcmd);

            // Clean up temporary files
            fs.unlinkSync(img);
            for (let j = 0; j < 16; j++) {
                fs.unlinkSync(`${img}.${j}.png`);
            }
}


async function GetChapterTitle(comicUrl)
{
        const comicPage = await makeRequest(comicUrl);
        const dom = new JSDOM(comicPage);
        const comicId = dom.window.document.getElementById('comici-viewer').getAttribute('comici-viewer-id'); //this is to deliberately throw an error if the chapter isn't public
        title = dom.window.document.getElementById('wait_free_article_title').innerHTML;
        title = title.split(' ')[0].replace(/[^A-Za-z0-9\s]/g, '').replace(/[^\x00-\x7F]/g, "").trimEnd();
        return title;
}

async function DeleteChapter(title)
{
    if(fs.existsSync(title))
    {
        fs.rmSync(title, {recursive: true, force: true });
    }
}

async function DownloadChapter(comicUrl) {
    try {
        // Get the comic page and extract comic ID
        console.log('Getting comic page...');
        const comicPage = await makeRequest(comicUrl);
        const dom = new JSDOM(comicPage);
        const comicId = dom.window.document.getElementById('comici-viewer').getAttribute('comici-viewer-id');
        title = dom.window.document.getElementById('wait_free_article_title').innerHTML;
        console.log(`Title: ${title}`);
        title = title.split(' ')[0].replace(/[^A-Za-z0-9\s]/g, '').replace(/[^\x00-\x7F]/g, "").trimEnd();

        if(!title.includes("Karte") && !title.includes("Score"))
        {
            throw new Error("Not a valid BokuYaba or OneYaba chapter.");
        }        

        console.log(`Title: ${title}`);

        if(!fs.existsSync(title))
        {
            fs.mkdirSync(title);
        }
        
        if (!comicId) {
            throw new Error('Could not find comic viewer ID');
        }
        
        console.log(`Comic ID: ${comicId}`);

        // Get total page count
        console.log('Getting comic info...');
        const infoUrl = `https://championcross.jp/book/contentsInfo?user-id=0&comici-viewer-id=${comicId}&page-from=0&page-to=1`;
        const infoResponse = await makeRequest(infoUrl, headers);
        const infoObj = JSON.parse(infoResponse);
        const totalPages = infoObj.totalPages;
        
        console.log(`${totalPages} total pages`);
        console.log('');

        // Get all pages
        console.log('Getting images...');
        const allPagesUrl = `https://championcross.jp/book/contentsInfo?user-id=0&comici-viewer-id=${comicId}&page-from=0&page-to=${totalPages}`;
        const allPagesResponse = await makeRequest(allPagesUrl, headers);
        const comicInfo = JSON.parse(allPagesResponse);

        var actions = comicInfo.result.map(unscramble_page);
        await Promise.all(actions);
        
        console.log('Done');

        return title

    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

//main();