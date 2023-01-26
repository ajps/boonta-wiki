const { imageHash } = require('image-hash');
const fs = require('fs')
const https = require('https');
const path = require('path')

let rp = require('request-promise-native');
let Parser = require('rss-parser');

let parser = new Parser();

const FEED_URL = 'http://feeds.soundcloud.com/users/soundcloud:users:307723090/sounds.rss';

function mainEpisodeFilter(item) {
    return item.title.match(/EPISODE \d+:/)
}

function rewriteImageResolution(imageUrl) {
    return imageUrl.replace(/3000x3000\.jpg$/, "500x500.jpg")
}

// async function (destinationFilename, url) {
//   return new Promise((resolve, reject) => {
//       if (fs.existsSync(destinationFilename)) {
//         //file exists
//       } else {
    
//       }
//   })
// }

async function downloadAndHash(destinationFilename, url) {
    return new Promise((resolve, reject) => {

        const request = https.request(url, (response) => {
            response.setEncoding('binary');
            let data = '';
            response.on('data', (chunk) => {
                data = data + chunk;
            });

            response.on('end', () => {
                fs.writeFileSync(destinationFilename, data, 'binary');

                imageHash({
                    ext: 'image/jpeg',
                    data: Buffer.from(data, 'binary')
                }, 8, true, (error, hashData) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(hashData);
                    }
                });
            });
        })

        request.on('error', (error) => {
            reject(error);
            console.log('An error', error);
        });

        request.end()
    })
}

(async () => {

    let feed = await parser.parseURL(FEED_URL);
    console.log(feed.title);

    let mainEpisodes = feed.items.filter(mainEpisodeFilter).reverse()

    mainEpisodes.slice(72, 76).forEach(async item => {
        item.image = rewriteImageResolution(item.itunes.image)
        item.filename = item.image.split("/").pop();
        item.imageHash = await downloadAndHash(item.filename, item.image)
        console.log(item.title)
        console.log('Published: ' + item.pubDate)
        console.log('Soundcloud slug: ' + item.link.substring(35))
        console.log('Artwork: ' + item.image)
        console.log('Hash: ' + item.imageHash)
        // console.log('Description: ' + item.content)
        console.log("----")
    });
})();
