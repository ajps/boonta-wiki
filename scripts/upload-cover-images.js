const PodcastData = require("../src/podcast-data");
const WikiSession = require("../src/wiki-session");

(async () => {
    let podcastData = new PodcastData({ load: true })
    let images = podcastData.imageData

    let wikiSession = new WikiSession()
    await wikiSession.loginToWiki(process.env.WIKI_USERNAME, process.env.WIKI_PASSWORD)

    for (const hash of images.getHashList()) {
        const filename = images.getImageFilename(hash)
        if (filename == 'episode_1_bonus_cover_image.png') continue;
        if (filename == 'episode_7_bonus_cover_image.jpg') continue;
        if (await (wikiSession.coverImageExists(filename))) {
            console.log(filename + " already in wiki")
        } else {
            console.log(`Uploading '${filename}'`)
            await wikiSession.uploadCoverImage(filename, images.getImageData(hash))
        }
    }
})()
