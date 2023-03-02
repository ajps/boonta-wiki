const fs = require('fs')
const ConsolidatedImages = require('./consolidated-images');
const Fuse = require('fuse.js');
let Parser = require('rss-parser');
const path = require('path');
const csv = require('fast-csv');
const Session = require('./session');

const MAIN_FEED_URL = 'http://feeds.soundcloud.com/users/soundcloud:users:307723090/sounds.rss';
const PATREON_FEED_URL = 'https://www.patreon.com/rss/BoontaVista?auth=qzgxJsPyRuqoRsMnEEOdKh9-rzB8oDgL';
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NZ8YyFFvY27TTl5G7aeXW8k0MXKv4wMfjmhup7puLNg/export?format=tsv&gid=0'
const CACHE_DIR = 'cache'
const NINE_HOURS = 32400000

function mainEpisodeFilter(item) {
    return item.title.startsWith('EPISODE') || item.title.startsWith('GUEST PODCAST') || item.title.startsWith('LIVE')
}

function bonusEpisodeFilter(item) {
    if (mainEpisodeFilter(item)) return false;

    const titleStart = item.title.split(":")[0]
    if (titleStart != titleStart.toUpperCase()) return false;

    return true;
}

function unlockedBonusEpisodeFilter(item) {
    return item.title.startsWith('UNLOCKED')
}

function rewriteSoundcloudImageResolution(imageUrl) {
    return imageUrl.replace(/3000x3000\.jpg$/, "500x500.jpg")
}


class PodcastData {
    #episodeList
    #wikiNameIndex

    constructor(options = {}) {
        this.consolidatedImages = new ConsolidatedImages({ cacheDir: CACHE_DIR })
        if (options.load) {
            this.load()
        }
    }

    get episodeList() {
        return this.#episodeList;
    }

    get imageData() {
        return this.consolidatedImages
    }

    #mapMainEpisodeToData(item) {
        let lowResUrl = rewriteSoundcloudImageResolution(item.itunes.image)
        let titleColonIndex = item.title.indexOf(':')

        let episodeData = {
            episodeType: 'main',
            episodeName: item.title.substring(titleColonIndex + 2),
            feedPubDate: item.pubDate,
            pubDate: Date.parse(item.pubDate) + NINE_HOURS,
            imageUrl: lowResUrl,
            imageUploadFilename: lowResUrl.split("/").pop(),
            soundcloudSlug: item.link.substring(35),
        }

        if (item.title.startsWith("GUEST PODCAST")) {
            episodeData.episodeType = 'guest'
        } else if (item.title.startsWith('LIVE')) {
            if (item.title.includes("To Serve Egg")) {
                episodeData.episodeNumber = "239"
            } else {
                episodeData.episodeType = 'bonus'
            }
        } else {
            episodeData.episodeNumber = item.title.match(/^EPISODE (\d+):/)[1]
        }

        // For some reason the feed date for episode 28 is the same as episode 47,
        // though the soundcloud page for the episode has the 20th May date and
        // they were, based on the content, not released together. Stoy's similar
        // for ep 75.
        if (episodeData.episodeNumber == "48") episodeData.pubDate = Date.parse("20 May 2018") + NINE_HOURS
        if (episodeData.episodeNumber == "75") episodeData.pubDate = Date.parse("25 Nov 2018") + NINE_HOURS

        return episodeData
    }

    #mapBonusEpisodeToData(item, idx) {
        let titleColonIndex = item.title.indexOf(':')

        let episodeData = {
            episodeType: 'bonus',
            episodeName: item.title.substring(titleColonIndex + 2),
            feedPubDate: item.pubDate,
            pubDate: Date.parse(item.pubDate),
            imageUrl: item.itunes.image,
            patreonSlug: item.link.match("posts/(.+)")[1],
        }

        if (item.unlockedAs) {
            episodeData.soundcloudSlug = item.unlockedAs.link.substring(35)
            episodeData.unlockedPubDate = Date.parse(item.unlockedAs.pubDate)
        }
        // They introduced the first 13 with their own episode numbers
        // that we are treating as canonical
        if (idx < 14) episodeData.episodeNumber = '' + (idx + 1)

        if (item.title.startsWith('BONUS MINISODE:') || item.title.startsWith('MINISODE:')) {
            episodeData.episodeType = 'minisode'
        } else if (item.title.startsWith('VOICEMAIL')) {
            episodeData.episodeType = 'voicemails'
        } else if (item.title.startsWith('TOPICAL REPOST')) {
            episodeData.episodeType = 'repost'
        }

        if (episodeData.episodeName === "If It Ain't Woke Don't Fix It Vol. 2") {
            // Move it to be just after ep 44 instead of just before
            episodeData.pubDate = Date.parse("2018-04-25T10:42:18.000Z") 
        } else if (episodeData.episodeName === "Two And A Half Straight Men") {
            // Move it so it's just before ep 127 instead of just after
            episodeData.pubDate = Date.parse("2019-12-03T08:00:00.000Z")
        } else if (episodeData.episodeName === "Ass Wednesday") {
            // Move it to be just after ep 130 instead of a day before
            episodeData.pubDate = Date.parse("2020-01-05T09:05:00.000Z") 
        }

        return episodeData
    }

    #addWikiTitlesToData(data) {
        this.#wikiNameIndex = {}

        let lastMainEpisode = 1
        let bonusCountForEpisode = 1
        data.forEach((item, itemIdx) => {
            switch (item.episodeType) {
                case 'main':
                    item.wikiName = `episode_${item.episodeNumber}`
                    lastMainEpisode = item.episodeNumber
                    bonusCountForEpisode = 1
                    break
                case 'guest':
                    item.wikiName = `episode_${lastMainEpisode}_bonus_${item.episodeType}`
                    break
                case 'repost':
                case 'minisode':
                case 'voicemails':
                    item.wikiName = `episode_${lastMainEpisode}_${item.episodeType}`
                    break
                default:
                    // We need to handle the early bonus episodes where numbers aren't
                    // related to the main episodes.
                    if (item.episodeNumber) {
                        item.wikiName = `episode_${item.episodeNumber}_bonus`
                    } else {
                        item.wikiName = `episode_${lastMainEpisode}_bonus${bonusCountForEpisode > 1 ? "_" + bonusCountForEpisode : ""}`
                        bonusCountForEpisode = bonusCountForEpisode + 1
                    }
            }

            if (!item.imageUploadFilename) {
                const extensionMatch = item.imageUrl.match(/(\.[A-Za-z]+)\?/)
                item.imageUploadFilename = `${item.wikiName}_cover_image${extensionMatch ? extensionMatch[1] : '.jpeg'}`
            }
        
            this.#wikiNameIndex[item.wikiName] = itemIdx
        })
    }

    episodeDataFromWikiTitle(title) {
        return this.#episodeList[this.#wikiNameIndex[title]]
    }

    async #addImageHashesToData(data) {
        for (const element of data) {
            element.imageHash = await this.consolidatedImages.addImage(element.imageUrl, element.imageUploadFilename)
        }
    }

    save() {
        const saveData = {
            episodeList: this.#episodeList,
            spreadsheet: this.spreadsheet,
            wikiNameIndex: this.#wikiNameIndex
        }
        fs.writeFileSync(path.resolve(CACHE_DIR, 'podcast-data.json'), JSON.stringify(saveData))
        this.consolidatedImages.save()
    }

    load() {
        const filename = path.resolve(CACHE_DIR, 'podcast-data.json')
        if (fs.existsSync(filename)) {
            const loadedData = JSON.parse(fs.readFileSync(filename))
            this.#episodeList = loadedData.episodeList
            this.spreadsheet = loadedData.spreadsheet
            this.#wikiNameIndex = loadedData.wikiNameIndex
            this.consolidatedImages.load()
        } else {
            console.log(`Can't load podcast data from '${filename}', file does not exist.`)
        }
    }


    // Off-the-shelf libraries don't seem to handle google sheets' embedded
    // newlines in cells cleanly, so this is a primitive parser that does
    // that and not much else
    #parseTsvWithTonsOfEmbeddedNewlinesToJson(data) {
        const HEADER_LINE = 2
        const DATA_START = 3

        var lines = data.split("\r\n");

        var result = [];
        var headers = lines[HEADER_LINE].split("\t");

        for (var i = DATA_START; i < lines.length; i++) {

            var obj = {};
            var currentline = lines[i].split("\t");

            for (var j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j];
            }
            result.push(obj);
        }
        return result
    }

    // removes the formula pasted into the header lines on line 2
    // of the sheet to make the rest fairly cleanly parsable
    #cleanInputTsvData(dirtyData) {
        return dirtyData.replace(/"=""====[\s\S]+?""\)"/m, "")
    }

    async loadSpreadsheet() {
        // let dirtyGoogleSheetsFile = fs.readFileSync(path.resolve('main-sheet.tsv'), 'utf-8')
        let dirtyGoogleSheetsFile = (await new Session().get(GOOGLE_SHEET_URL)).body
        return this.#parseTsvWithTonsOfEmbeddedNewlinesToJson(this.#cleanInputTsvData(dirtyGoogleSheetsFile))
    }

    async refresh() {
        let parser = new Parser();

        console.log("Loading spreadsheet...")
        this.spreadsheet = await this.loadSpreadsheet() 

        console.log("Fetching feeds...")
        let mainFeed = await parser.parseURL(MAIN_FEED_URL);
        let bonusFeed = await parser.parseURL(PATREON_FEED_URL);

        // let mainFeed = await parser.parseString(fs.readFileSync('sounds.rss'));
        // let bonusFeed = await parser.parseString(fs.readFileSync('BoontaVista.rss'));

        // Then find where the unlocked bonus items are in the main feed
        let unlockedBonusEpisodesFeed = mainFeed.items.filter(unlockedBonusEpisodeFilter).reverse()

        console.log("Unlocking bonus episodes...")
        const fuse = new Fuse(bonusFeed.items, { includeScore: true, keys: ['title'] })
        for (const item of unlockedBonusEpisodesFeed) {
            let fuzzyMatch = fuse.search(item.title)
            if (fuzzyMatch && fuzzyMatch[0].score < 0.8) {
                fuzzyMatch[0].item.unlockedAs = item
            } else {
                console.log("UNMATCHED UNLOCKED BONUS " + item.title)
            }
        }

        // Then extract all the data we actually want, and consolidate
        // into one sorted array.
        console.log("Extracting data...")
        let mainEpisodesData = mainFeed.items.filter(mainEpisodeFilter).reverse().map(this.#mapMainEpisodeToData);
        let bonusEpisodesData = bonusFeed.items.filter(x => bonusEpisodeFilter(x)).reverse().map(this.#mapBonusEpisodeToData);
        let mergedData = mainEpisodesData.concat(bonusEpisodesData).sort((a, b) => a.pubDate - b.pubDate)

        // Complete the dataset with stuff we can't just get from the feeds directly
        console.log("Filling in blanks...")
        this.#addWikiTitlesToData(mergedData)
        console.log("Processing cover images...")
        await this.#addImageHashesToData(mergedData)

        this.#episodeList = mergedData

        console.log("Refresh done.")
        return this;
    }
}

module.exports = PodcastData