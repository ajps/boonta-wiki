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
        }, 'no-redirect')
        if (response.statusCode != 302) throw new Error("Ah crap, not logged in")
    }

    async coverImageExists(filename) {
        const urlToCheck = this.WIKI_ROOT + 'lib/exe/fetch.php?media=cover-image:' + filename
        let response = await this.session.head(urlToCheck)
        return response.statusCode == 200
    }

    extractInputValue(body, fieldName, opts = []) {
        if (typeof opts === 'string') opts = [opts]

        let tokenmatch = body.match(new RegExp(`input type="hidden" name="${fieldName}" value="([0-9a-f]+)"`))
        if (!tokenmatch) {
            if (opts.includes('optional')) return ''
            else throw new Error(`token '${fieldName}'not found\n` + body)
        }

        return tokenmatch[1]
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
        return this.extractInputValue(response.body, 'sectok')
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

    async updatePage(pageName, newContents) {
        let response = await this.session.get(this.WIKI_ROOT + `doku.php?id=${pageName}&do=edit`)
        if (response.statusCode != 200) throw new Error("Ah crap, error: " + response.body)

        let securityToken = this.extractInputValue(response.body, 'sectok')
        let changeCheck = this.extractInputValue(response.body, 'changecheck')
        let dateCheck = this.extractInputValue(response.body, 'date', 'optional')

        let urlParams = querystring.stringify({
            id: pageName,
            do: 'edit'
        })

        let formContents = {
            sectok: securityToken,
            id: pageName,
            prefix: '.',
            suffix: '',
            rev: 0,
            date: dateCheck,
            changecheck: changeCheck,
            target: 'section',
            wikitext: newContents,
            'do[save]': 1,
            summary: 'scripted upload from spreadsheet'
        };

        return await this.session.postUrlEncodedForm(this.WIKI_ROOT + 'doku.php?' + urlParams, formContents)
    }

    async deletePage(pageName) {
        return updatePage(pageName, '') 
    }
}

module.exports = WikiSession