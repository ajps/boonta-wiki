const PodcastData = require("../src/podcast-data");
const WikiSession = require("../src/wiki-session");
const fs = require('fs')

async function writeSimpleTsv(filename, jsonDataArray, headers) {
    if (!headers) {
        headers = Object.keys(jsonDataArray[0])
    }
    
    return new Promise((resolve, reject) => {
        let writeStream = fs.createWriteStream(filename);

        // the finish event is emitted when all data has been flushed from the stream
        writeStream.on('finish', () => {
            console.log('wrote all data to file');
            resolve(true)
        });

        writeStream.on('error', (err) => {
            reject(err)
        })

        writeStream.write(headers.join('\t') + '\n');

        jsonDataArray.forEach((entry) => {
            writeStream.write(Object.values(entry).join('\t') + '\n');
        })

        // close the stream
        writeStream.end();
    })
}

(async () => {
    let podcastData = new PodcastData({ load: true })

    let images = podcastData.imageData
    let spreadsheet = podcastData.spreadsheet

    let sheetExtract = spreadsheet.map((item) => {
        let wikiName = 'episode_' + item["Episode Number"].toLowerCase().replaceAll(" ", "_")
        let feedData = podcastData.episodeDataFromWikiTitle(wikiName)
        let feedCoverImage
        if (feedData) {
            feedCoverImage = "cover-image:" + images.getImageFilename(feedData.imageHash)
        } else {
            feedCoverImage = ''
        }
        let feedSoundcloud = feedData ? feedData.soundcloudSlug || '' : ''

        return {
            wikiName: wikiName,
            episodeName: item["Episode Name"],
            pubDate: item["Date Released"],
            feedSoundcloud: feedSoundcloud,
            sheetSoundcloud: item["Soundcloud Name"],
            feedCoverImage: feedCoverImage,
            sheetCoverImage: item["Cover Image (filename on the wiki) If no cover is available, the markdown generator will use the generic BV logo."],
        }
    })


    writeSimpleTsv("imageExtract.tsv", sheetExtract)
})()
