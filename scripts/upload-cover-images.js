const PodcastData = require("../src/podcast-data");
const WikiSession = require("../src/wiki-session");

(async () => {
    let podcastData = new PodcastData({ load: true })
    let images = podcastData.imageData

    let wikiSession = new WikiSession()
    await wikiSession.loginToWiki(process.env.WIKI_USERNAME, process.env.WIKI_PASSWORD)

    for (const hash of images.getHashList().slice(0, 5)) {
        const filename = images.getImageFilename(hash)
        if (await (wikiSession.coverImageExists(filename))) {
            console.log(filename + " already in wiki")
        } else {
            console.log(`Uploading '${filename}'`)
            await wikiSession.uploadCoverImage(leafname, images.getImageData(hash))
        }
    }
})()
