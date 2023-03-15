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

    /** 
        A wrapper for request methods you can use if you want to 
        follow 3xx redirect response codes with a GET rather than
        get the initial response back as-is.
    */
    async followRedirect(request) {
        let response = await request
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            response = await this.get(response.headers['location'])
        }
        return response
    }

    async get(url, opts = []) {
        if (typeof opts === 'string') opts = [opts]

        var requestOptions = {
            method: 'GET',
            headers: {
                'Accept': '*/*'
            }
        };

        if (opts.includes('no-redirect')) {
            return this.sendRequest(url, requestOptions)
        } else {
            return await this.followRedirect(this.sendRequest(url, requestOptions))
        }
    }

    async postUrlEncodedForm(url, formData, opts = []) {
        var postData = querystring.stringify(formData);
        if (typeof opts === 'string') opts = [opts]

        var requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length,
            }
        };

        if (opts.includes('no-redirect')) {
            return this.sendRequest(url, requestOptions, postData)
        } else {
            return await this.followRedirect(this.sendRequest(url, requestOptions, postData))
        }
    }

    async post(url, headers, body, opts = []) {
        if (typeof opts === 'string') opts = [opts]

        const defaultHeaders = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body.length,
        }

        var requestOptions = {
            method: 'POST',
            headers: { ...defaultHeaders, ...headers }
        };

        if (opts.includes('no-redirect')) {
            return this.sendRequest(url, requestOptions, body)
        } else {
            return await this.followRedirect(this.sendRequest(url, requestOptions, body))
        }
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