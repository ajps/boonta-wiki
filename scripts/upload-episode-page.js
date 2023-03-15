const PodcastData = require("../src/podcast-data");
const WikiSession = require("../src/wiki-session");

(async () => {
    let podcastData = new PodcastData({ load: true })
    let wikiSession = new WikiSession()

    await wikiSession.loginToWiki(process.env.WIKI_USERNAME, process.env.WIKI_PASSWORD)

    let demoPage = podcastData.spreadsheetDataFromWikiTitle('episode_31')['Outputs Here  (copy and paste cell into DokuWiki)']
    console.log(demoPage)
    let updatedHTML = await wikiSession.updatePage('playground:page', demoPage)
})()
