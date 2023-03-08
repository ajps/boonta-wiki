const Session = require("./session")
const querystring = require('node:querystring');

class WikiSession {
    WIKI_ROOT = 'https://boontavista.com/wiki/'

    constructor() {
        this.session = new Session()
    }

    async loginToWiki(username, password) {
        let response = await this.session.postUrlEncodedForm(this.WIKI_ROOT + 'doku.php', {
            sectok: '',
            id: 'start',
            do: 'login',
            u: username,
            p: password
        })
        if (response.statusCode != 302) throw new Error("Ah crap, not logged in")
    }

    async coverImageExists(filename) {
        const urlToCheck = this.WIKI_ROOT + 'lib/exe/fetch.php?media=cover-image:' + filename
        let response = await this.session.head(urlToCheck)
        return response.statusCode == 200
    }

    async getUploadSecurityToken() {
        let response = await this.session.postUrlEncodedForm(this.WIKI_ROOT + 'lib/exe/ajax.php', {
            call: "medialist",
            tab_files: "upload",
            do: "media",
            id: 'start',
            ns: "cover-image"
        })
        if (response.statusCode != 200) throw new Error("Ah crap, error: " + response.body)

        // Pull out the security token which is hopefully all we need
        let tokenmatch = response.body.match(/input type="hidden" name="sectok" value="([0-9a-f]+)"/)
        if (!tokenmatch) throw new Error("token not found\n" + response.body)

        return tokenmatch[1]
    }

    async uploadCoverImage(filename, imageData) {
        let securityToken = await this.getUploadSecurityToken()

        let params = querystring.stringify({
            tab_files: 'files',
            tab_details: 'view',
            do: 'media',
            ns: 'cover-image',
            sectok: securityToken,
            mediaid: '',
            call: 'mediaupload',
            qqfile: filename,
            ow: false
        });

        let headers = {
            'X-File-Name': filename,
            'Content-Type': 'application/octet-stream'
        }

        let response = await this.session.post(this.WIKI_ROOT + 'lib/exe/ajax.php?' + params, headers, imageData)
        console.log(response.body)
    }
}

module.exports = WikiSession