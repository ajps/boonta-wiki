const PodcastData = require("../src/podcast-data");
const WikiSession = require("../src/wiki-session");
const fs = require('fs')

async function writeSimpleTsv(filename, jsonDataArray, headers) {
    if (!headers) {
        headers = Object.keys(jsonDataArray[0])
    }
    
    return new Promise((resolve, reject) => {
        let writeStream = fs.createWriteStream(filename);

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

        writeStream.end();
    })
}

(async () => {
    let podcastData = new PodcastData({ load: true })

    let spreadsheet = podcastData.spreadsheet

    let output = []
    for (let sheetIdx = 0, dataIdx = 0; spreadsheet[sheetIdx]["Episode Name"] != "" &&  podcastData.episodeList[dataIdx]; ) {
        let line = {}

        let sheetItem = spreadsheet[sheetIdx]
        let wikiName = 'episode_' + sheetItem["Episode Number"].toLowerCase().replace(/\s/g, "_")
        let sheetEpisodeNumber = parseInt(sheetItem["Episode Number"])

        let feedItem = podcastData.episodeList[dataIdx]
        let feedEpisodeNumber = parseInt(feedItem.wikiName.match(/episode_(\d+)/)[1])

        if (wikiName == feedItem.wikiName) {
            line.sheetWikiName = wikiName
            line.sheetEpisodeName = sheetItem["Episode Name"]
            line.sheetPubDate = sheetItem["Date Released"]

            line.feedWikiName = feedItem.wikiName
            line.feedEpisodeName = feedItem.episodeName
            line.feedPubDate = new Date(feedItem.pubDate).toISOString()

            sheetIdx ++;
            dataIdx ++;
        } else if (sheetEpisodeNumber < feedEpisodeNumber || isNaN(sheetEpisodeNumber)) {
            line.sheetWikiName = wikiName
            line.sheetEpisodeName = sheetItem["Episode Name"]
            line.sheetPubDate = sheetItem["Date Released"]

            line.feedWikiName = '-x-'
            line.feedEpisodeName = '-x-'
            line.feedPubDate = '-x-'

            sheetIdx++;
        } else {
            line.sheetWikiName = '-x-'
            line.sheetEpisodeName = '-x-'
            line.sheetPubDate = '-x-'

            line.feedWikiName = feedItem.wikiName
            line.feedEpisodeName = feedItem.episodeName
            line.feedPubDate = new Date(feedItem.pubDate).toISOString()

            dataIdx++;
        }

        output.push(line)
    }
    writeSimpleTsv("sheetComparison.tsv", output)
})()
