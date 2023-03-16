const PodcastData = require("../src/podcast-data");
const Session = require("../src/session");

(async () => {
    let podcastData = new PodcastData({ load: true })
    let spreadsheet = podcastData.spreadsheet
    let session = new Session()

    let lines = spreadsheet.filter(line => line["Soundcloud Name"] != 'n/a' && line["Soundcloud Name"].trim() != '')

    for (const line of [lines[0]]) {
        console.log(`Checking ${line["Soundcloud Name"]}`)
        let response = await session.head(`https://soundcloud.com/boontavista/${line["Soundcloud Name"]}`);
        // Doesn't work, you get a 200 back every time, need API access to check if it actually
        // exists.
        if (response.statusCode != 200) {
            console.log(`Couldn't load ${line["Soundcloud Name"]}, episode ${line["Episode Name"]}`)
        }
    }
})()
