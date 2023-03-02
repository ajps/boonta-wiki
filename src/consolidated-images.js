const { imageHash } = require('image-hash');
const fs = require('fs')
const https = require('https');
const path = require('path')

const CACHE_DIR = 'cache'

class ConsolidatedImages {
    constructor(options = {}) {
        this.imageHashMap = {}
        this.urlImageHash = {}

        this.cacheDir = options.cacheDir || CACHE_DIR
    }

    #getCacheLocation(filename) {
        return path.resolve(this.cacheDir, filename)
    }

    serialize() {
        return JSON.stringify({
            imageHashMap: this.imageHashMap,
            urlImageHash: this.urlImageHash,
            cacheLocation: this.cacheDir
        })
    }

    unserialize(jsonString) {
        let savedData = JSON.parse(jsonString)
        this.imageHashMap = savedData.imageHashMap
        this.urlImageHash = savedData.urlImageHash
        this.cacheDir = savedData.cacheLocation
    }

    save() {
        fs.writeFileSync(path.resolve(CACHE_DIR, 'image-data.json'), this.serialize())
    }

    load() {
        const filename = path.resolve(CACHE_DIR, 'image-data.json')
        if (fs.existsSync(filename)) {
            this.unserialize(fs.readFileSync(filename))
        } else {
            console.log(`Can't load image data from '${filename}', file does not exist.`)
            this.imageHashMap = {}
            this.urlImageHash = {}
        }
    }

    async loadImageToBuffer(url, uploadFilename) {
        return new Promise((resolve, reject) => {
            if (this.checkFileCache(uploadFilename)) {
                resolve(fs.readFileSync(this.#getCacheLocation(uploadFilename)));
            } else {
                const request = https.request(url, (response) => {
                    response.setEncoding('binary');
                    let data = '';
                    response.on('data', (chunk) => {
                        data = data + chunk;
                    });

                    response.on('end', () => {
                        resolve(data);
                    })
                })

                request.on('error', (error) => {
                    reject(error);
                    console.log('An error', error);
                });

                request.end()
            }
        })
    }

    checkFileCache(url) {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir);
            return false;
        } else {
            const fullFilename = this.#getCacheLocation(url)
            if (fs.existsSync(fullFilename)) {
                return true
            } else {
                return false
            }
        }
    }

    addToImageHashMap(hash, url, filename, data) {
        if (!this.imageHashMap[hash]) {
            this.imageHashMap[hash] = filename
            this.urlImageHash[url] = hash
        }
        fs.writeFileSync(this.#getCacheLocation(filename), data, 'binary');
    }

    getImageFilename(hash) {
        return this.imageHashMap[hash]
    }

    getImageData(hash) {
        return fs.readFileSync(this.#getCacheLocation(this.imageHashMap[hash]))
    }

    getHashList() {
        return Object.keys(this.imageHashMap)
    }

    async addImage(url, uploadFilename) {
        return new Promise((resolve, reject) => {
            if (this.urlImageHash[url]) {
                resolve(this.urlImageHash[url])
            } else {
                this.loadImageToBuffer(url, uploadFilename).then(data => {
                    imageHash({ name: uploadFilename, data: Buffer.from(data, 'binary') }, 8, true, (error, hashData) => {
                        if (error) {
                            reject(error);
                        } else {
                            this.addToImageHashMap(hashData, url, uploadFilename, data)
                            resolve(hashData);
                        }
                    });
                })
            }
        })
    }
}

module.exports = ConsolidatedImages