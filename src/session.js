const https = require('https');
const http = require('http');
const querystring = require('querystring');

class Session {
    constructor() {
        this.userAgent = 'curl/7.81.0'
        this.cookies = {}
    }

    async head(url) {
        var options = {
            method: 'HEAD',
            headers: {
                'Accept': '*/*'
            }
        };

        return this.sendRequest(url, options)
    }

    async get(url) {
        var options = {
            method: 'GET',
            headers: {
                'Accept': '*/*'
            }
        };

        let response = await this.sendRequest(url, options)
        if (response.statusCode == 307) {
            response = await this.sendRequest(response.headers['location'], options)
        }
        return response
    }

    async postUrlEncodedForm(url, formData) {
        var postData = querystring.stringify(formData);

        var options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            }
        };

        return this.sendRequest(url, options, postData)
    }

    async post(url, headers, body) {
        const defaultHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body.length,
        }

        var options = {
            method: 'POST',
            headers: { ...defaultHeaders, ...headers }
        };
        console.log(options)
        return this.sendRequest(url, options, body)
    }

    async sendRequest(url, options, postData) {
        return new Promise((resolve, reject) => {
            options.headers['User-Agent'] ||= this.userAgent
            options.headers['Cookie'] ||= this.#getCookieHeader()
            const thisSession = this

            // request object
            var req = https.request(url, options, function (res) {
                var result = {
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: ''
                }

                res.on('data', function (chunk) {
                    result.body += chunk;
                });
                res.on('end', function () {
                    thisSession.#updateCookies(result.headers)
                    resolve(result)
                });
                res.on('error', function (err) {
                    reject(err)
                })
            });

            // req error
            req.on('error', function (err) {
                console.log(err);
            });

            //send request witht the postData form
            if (postData) req.write(postData);
            req.end();
        })
    }

    #getCookieHeader() {
        var header = ''
        for (const [key, value] of Object.entries(this.cookies)) {
            header += key + '=' + value + '; '
        }
        return header
    }

    #updateCookies(headers) {
        // half-arsed cookie implmentation
        if (headers['set-cookie']) {
            headers['set-cookie'].forEach(element => {
                var pieces = element.match(/^([^=]+)=([^;]+)/)
                if (pieces[1] && pieces[2]) {
                    if (pieces[2] == 'deleted') {
                        delete this.cookies[pieces[1]]
                    } else {
                        this.cookies[pieces[1]] = pieces[2]
                    }
                }
            });
        }
    }
}

module.exports = Session