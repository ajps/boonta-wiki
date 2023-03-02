const PodcastData = require("../src/podcast-data");

(async () => {
    let podcastData = new PodcastData({ load: true })
    await podcastData.refresh()
    podcastData.save()
})()
