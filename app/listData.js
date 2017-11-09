/*
 * MIT License
 *
 * Copyright (c) 2017, Pentagonal
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const defaultMax = 35;
const writeData = require('../src/writer');
const is = require('../src/is');
const clc = require('cli-color');
const {convertCompanyURL} = require('../src/url')
const redisClient = require('redis').createClient();
const {RequestSock, Request} = require('../src/request');
const sha1 = require('../src/sha1');
const fs = require('fs');

/**
 * @type {{jQuery}}
 */
const {$} = require('p-proxies').jQuery;

if (!global.spinner) {
    global.spinner = new require('../src/spin');
    global.spinner.setDefaultSpinnerString(17);
    global.spinner.setSpinnerDelay(30);
}
let spinner = global.spinner;
const strip_tags = require('striptags');

const dataPath  = __dirname + '/../Data/Companies.csv';

let Proxies = [];
let CurrentProxy = null;

let cSockRequest = (
    name,
    baseUrl,
    url,
    options,
    errorCallback,
    resolveCallback,
    proxyHost = null,
    proxyPort = null
) => {
    let isUseProxy = !!(proxyPort && proxyHost);
    let methodRequest = isUseProxy ? RequestSock : Request;
    if (!is.fn(errorCallback)) {
        errorCallback = () => {};
    }
    if (!is.fn(resolveCallback)) {
        resolveCallback = () => {};
    }
    methodRequest(
        url,
        options,
        proxyHost,
        proxyPort
    ).then(({error, response, body}) => {
        if (error) {
            errorCallback(error);
            return;
        }
        if (response && response.statusCode !== 200) {
            errorCallback(new Error('Invalid Response Code'));
            return;
        }
        body = $(body);
        let details = {
            name: name,
            phone: "",
            url: url,
            email: [],
            industry: "",
            working_hours: "",
            location: "",
            employees: "",
            benefits: "",
            language: "",
            description: "",
        };
        let founds = false;
        details.description = strip_tags(body.find('[itemprop="description"] moreless').html());
        details.description=  details.description.toString()
                .replace(/^\s+/m, '')
                .replace(/\s+$/m, '')
                .replace(/&nbsp;\s*/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\n[\s]+/g, '\n')
                .replace(/(\n)+/, '$1')
                .replace(/^\s*/g, '')
                .replace(/\s*$/g, '');
        details.description =  details.description
            ? $('<textarea />').html(details.description).text()
            : "";
        details.location = strip_tags(body.find('.zeroPadding .company-map-location-add').html());
        details.location = details.location
            ? $('<textarea />').html(details.location).text().replace(/^\s*/g, '').replace(/\s*$/g, '')
            : "";
        if (details.description !== '') {
            details.description.toString()
                .replace(
                    /((?:[a-z0-9][0-9a-z._\-]+)[a-z0-9]@[^.]+\.[^\s]+)/gim,
                    function (m, email) {
                        details.email.push(email)
                    }
                );
        }

        body.find('.company-snapshot-card .company-snapshot-wrap').each(function() {
            let $this = $(this);
            let title = $this.find('.company-snapshot-title').html() || "";
            let desc = $this.find('.company-snapshot-desc').html() || "";
            if (!title || ! desc) {
                return;
            }
            title = $('<textarea />')
                .html(title)
                .text()
                .toString()
                .replace(/\t/, ' ')
                .replace(/\n[\s]+/, '\n')
                .replace(/(\n)+/, '$1')
                .replace(/^\s*/g, '')
                .replace(/\s*$/g, '');
            desc = $('<textarea />')
                .html(strip_tags(desc))
                .text()
                .toString()
                .replace(/\t/, ' ')
                .replace(/(\n)+/, '$1')
                .replace(/^\s*/g, '')
                .replace(/\s*$/g, '');
            if (!title || ! desc) {
                return;
            }
            founds = true;
            if (title.match(/(?:Tele)?phone/ig)) {
                if (!desc.match(/xx\s*/ig) && desc.replace(/\s*/, '') !== '-') {
                    desc = desc.replace(/^\s*/g, '')
                        .replace(/\s*$/, '')
                        .replace(/^\s*Telp?\s*[:.]?/i,'');
                    if (desc.match(/^\s*62/)) {
                        desc = desc.replace(/^\s*62([^0-9]+)?/, '+62 ')
                    } else if (desc.match(/^\s*[1-9]\s*[0-9]/g)) {
                        desc = `+62 ${desc}`
                    } else if (!desc.match(/-/) && desc.match(/^[0]/)) {
                        desc = `+62 ${desc.substr(1)}`;
                    } else if (!desc.match(/^\s*[0]62/)) {
                        desc = desc.replace(/^\s*[0]62\s*/, '+62 ')
                    }
                    details.phone = desc;
                }
            } else if (title.match(/Industr/ig)) {
                details.industry = desc;
            } else if (title.match(/(?:Company\s+)?Size/ig)) {
                details.employees = desc.replace(/\s*Employ(?:ee?|d)?s?/gi, '');
            } else if (title.match(/\sHours/ig)) {
                details.working_hours = desc;
            } else if (title.match(/\sHours/ig)) {
                details.working_hours = desc;
            } else if (title.match(/Benefits?/ig)) {
                details.benefits = desc;
            } else if (title.match(/Language/ig)) {
                details.language = desc;
            }
        });

        details.email = details.email.join(", ");
        if (details.email === "" && details.phone === "") {
            founds = false;
        }

        redisClient.set(
            sha1(baseUrl),
            founds ? JSON.stringify(details) : JSON.stringify([name]),
            'EX',
            (360 * 24 * 7 * 4)
        );
        resolveCallback(founds ? details : name);
    }).catch(errorCallback);
};

let timedOuted = {};
const attach = (
    {name, url},
    options,
    errorCallback,
    resolveCallback,
    retryTimeOut = 0,
    invalid
) => {
    if (!is.object(CurrentProxy) && Proxies.length) {
        CurrentProxy = Proxies.shift();
        CurrentProxy = is.object(CurrentProxy)
            ? CurrentProxy
            : null;
    }

    let proxyHost = is.object(CurrentProxy)
        ? CurrentProxy.ip
        : null;
    let proxyPort = proxyHost ? CurrentProxy.port : null;
    let isUsedProxy = proxyPort !== null;
    if (! invalid) {
        if (global.verbose) {
            console.log('☴  Company: ' + clc.blue(name));
        }
    }

    cSockRequest(
        name,
        url,
        convertCompanyURL(url),
        options,
        (error) => {
            if (error.message === 'Invalid Response Code') {
                errorCallback(error);
                return;
            }
            switch (error.message) {
                case 'ETIMEDOUT':
                case 'ESOCKETTIMEDOUT':
                    if (retryTimeOut > 3) {
                        retryTimeOut = 0;
                        errorCallback(error);
                        return;
                    }
                    if (global.verbose) {
                        // console.log(error);
                        // do again
                        if (!isUsedProxy) {
                            console.log(clc.red('☴  Error  : ') + `Connection to ${url} timeout! Retry to connect ....`);
                        } else {
                            console.log(clc.red('☴  Error  : ') + `Timeout Proxy [${proxyHost}:${proxyPort}]. Retry to connect ....`);
                        }
                    }
                    attach({name, url}, options, errorCallback, resolveCallback, retryTimeOut++, true);
                    break;
                default:
                        CurrentProxy = Proxies.shift();
                        if (global.verbose) {
                            if (isUsedProxy) {
                                if (CurrentProxy) {
                                    console.log(clc.red('☴  Error  : ') + `${error.message} . Retry with proxy[${CurrentProxy.ip}: ${CurrentProxy.port}].`);
                                } else {
                                    console.log(clc.red('☴  Error  : ') + `${error.message} . Retry to connect without proxy.`);
                                }
                            } else {
                                console.log(clc.red('☴  Error  : ') + `${error.message} . Retry to connect.`);
                            }
                        }
                        if (!CurrentProxy) {
                            errorCallback(error);
                        }
                        if (!is.number(timedOuted[url])) {
                            timedOuted[url] = 0;
                        }
                        if (timedOuted[url] > 10) {
                            delete timedOuted[url];
                            errorCallback(error);
                            return;
                        }
                        timedOuted[url]++;
                        if ((timedOuted[url] % 3) === 0) {
                            setTimeout(() => attach({name, url}, options, errorCallback, resolveCallback, retryTimeOut, true), 1800);
                        } else {
                            attach({name, url}, options, errorCallback, resolveCallback, retryTimeOut, true);
                        }
                    break;
            }
        },
        resolveCallback,
        proxyHost,
        proxyPort
    )
};

let cacheHash = [];
const RequestingPerAlpha = (currentOffset, arrayKeySet, Object, resolve, reject) => new Promise((res) => {
    let mustBeRequest = [];
    let count = -1;
    let Total = 0;
    let numberPerAlpha = ! CurrentProxy
        ? (is.number(global['maxNumber']) && global['maxNumber'] > 5
            ? global['maxNumber']
            : defaultMax
        )
        : 5;
    for (let url in Object) {
        if (!Object.hasOwnProperty(url)) {
            continue;
        }

        if ((Total % numberPerAlpha) === 0) {
            Total++;
            count++;
            mustBeRequest[count] = {};
            mustBeRequest[count][Object[url]] = url;
            delete Object[url];
            continue;
        }

        if (!is.object(mustBeRequest[count])) {
            mustBeRequest[count] = {};
        }

        mustBeRequest[count][Object[url]] = url;
        delete Object[url];
        Total++;
    }

    let curr = 0;
    let init = () => {
        if (!is.object(mustBeRequest[curr])) {
            res(true);
            return;
        }

        let TLength = 0;
        for (let name in mustBeRequest[curr]) {
            if (! mustBeRequest[curr].hasOwnProperty(name)) {
                continue;
            }
            TLength++;
        }
        if (global.verbose) {
            console.log('-----------------------------------------');
            console.log(clc.cyan.bold(`\nRequesting async request at ${TLength} companies.\n`));
        }
        let csvExporter = (result, isCache, isArray) => {
            totalExecuted++;
            if (! isArray) {
                let key = sha1(result.url + result.name);
                if (is.array_contains(key)) {
                    if (!isCache && !global.verbose) {
                        console.log(clc.cyan('☴  Data   : ') + `Skipped duplicate [ ${result.name} ] for appending file.`);
                    }
                    return;
                }
                if (global.verbose) {
                    console.log(clc.blue('☴  Data   : ') + `for [ ${result.name} ] found append to file.`);
                }
                if (cacheHash.length >= numberPerAlpha) {
                    cacheHash.shift();
                }
                cacheHash.push(key);

                let csvData = "";
                for (let e in result) {
                    if (!result.hasOwnProperty(e)) {
                        // console.log(e);
                        // process.exit();
                        continue;
                    }
                    if (csvData !== "") {
                        csvData += ",";
                    }
                    csvData += JSON.stringify(result[e]);
                }
                // console.log(csvData);
                fs.appendFile(
                    dataPath,
                    csvData + "\r\n",
                    function (err) {
                        // console.log(err);
                        // pass
                    });
            } else {
                if (global.verbose && !isCache) {
                    console.log(clc.red('☴  Data   : ') + `for [ ${result} ] not found.`);
                }
            }
        };

        for (let name in mustBeRequest[curr]) {
            if (!mustBeRequest[curr].hasOwnProperty(name)) {
                continue;
            }

            // console.log(mustBeRequest[curr][name]);
            redisClient.get(sha1(mustBeRequest[curr][name]), function (err, value) {
                if (!err && is.string(value)) {
                    try {
                        value = JSON.parse(value.toString());
                        let isArray = is.array(value);
                        if (isArray || is.object(value) && is.string(value.name) && is.string(value.url)) {
                            csvExporter(isArray ? name : value, true, isArray);
                            return;
                        }
                    } catch (error) {
                        console.log(error);
                        process.exit();
                        // err = error;
                    }
                }

                attach({name, url: mustBeRequest[curr][name]},
                    {
                        timeout: 7000,
                        socketTimeOut: 2500,
                    },
                    (error) => {
                        console.error(error);
                        totalExecuted++;
                    },
                    csvExporter
                );
            });
        }

        let totalExecuted = 0;
        let uInterval = setInterval(() => {
            if (totalExecuted >= TLength) {
                clearInterval(uInterval);
                curr++;
                init();
            }
        }, 700);
    };
    init();
}).then((Result) => {
    resolve({Result: Result, offset: currentOffset, arrayKeySet: arrayKeySet});
}).catch((err) => {
    console.log(err);
    reject(err);
});

const ProcessAll = (ObjectURI, Proxy, proxies) => new Promise((resolve, reject) => {
    for (let code in proxies) {
        if (proxies.hasOwnProperty(code)) {
            for (let i = 0; proxies[code].length > i; i++) {
                Proxies.push(proxies[code][i]);
            }
        }
    }

    CurrentProxy = Proxy;
    proxies = {};
    Proxy = null;
    let arrayOffset = [];
    let callItAll = () => {

        if (! is.number(currentOffset)
            || ! is.string(arrayOffset[currentOffset])
        ) {
            resolve(true);
            return;
        }

        return RequestingPerAlpha(
            currentOffset,
            arrayOffset[currentOffset],
            ObjectURI[arrayOffset[currentOffset]],
            ({Result, offset, arrayKeySet}) => {
                // console.log(ObjectURI[arrayOffset[currentOffset+1]]);
                // console.log(currentOffset+1);
                // console.log(arrayOffset[currentOffset]);
                // process.exit();

                // clear
                delete ObjectURI[arrayKeySet];

                currentOffset++; // = offset+1;

                if (! is.string(arrayOffset[currentOffset])
                    || !is.object(ObjectURI[arrayOffset[currentOffset]])
                ) {
                    spinner.stop();
                    // console.log(currentOffset);
                    resolve(true);
                    return;
                }

                return callItAll();
            },
            (err) => {
                // console.log(err);

                // clear
                delete ObjectURI[arrayOffset[currentOffset]];

                currentOffset++;

                if (! is.string(arrayOffset[currentOffset])
                    || !is.object(ObjectURI[arrayOffset[currentOffset]])
                ) {
                    spinner.stop();
                    resolve(true);
                    return;
                }

                return callItAll();
            }
        );
    };

    for (let alpha in ObjectURI) {
        if (ObjectURI.hasOwnProperty(alpha)) {
            arrayOffset.push(alpha);
        }
    }

    let currentOffset = 0;
    callItAll();
});

module.exports = (ObjectURI, Proxy, Proxies) => (new Promise((resolve, reject) => writeData(
    dataPath,
    '"Name", "Phone", "Url", "Email", "Industry", "Working Hours", "Location", "Employee Size", "Benefits", "Language", "Description"\r\n',
    function (err) {
        if (!global.verbose) {
            spinner.start(clc.cyan.bold('Please wait'));
        }
        resolve(ProcessAll(ObjectURI,Proxy, Proxies));
    })).then((cb) => cb).catch((err) => {
        spinner.stop();
        console.log(err)
    }));