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

"use strict";

const is = require('./src/is');
const spinner = new require('./src/spin');
const clc = new require('cli-color');
const {proxyCrawl} = require('p-proxies').ProxySearch;
const {$} = require('p-proxies').jQuery;
const {Client, ClientSock5} = require('p-proxies').Request;
const fs = require('fs');

const Config = {
    baseURL: '68747470733a2f2f7777772e6a6f627374726565742e636f2e6964',
    baseBrowsURL: '68747470733a2f2f7777772e6a6f627374726565742e636f2e69642f656e2f636f6d70616e6965732f62726f7773652d',
    proxyCountry: [
        'US',
        'SG',
        'AU',
        'TW',
        'ID',
        'DE',
        'CA',
        'HK',
        'UK'
    ],
};

let browseURL = null;
let baseURL = null;

// #
spinner.start('\nGetting Proxy List', 'blue.bold.italic');

const convertBaseURL = (url) => {
    url = is.string(url) ? url.replace(/^\/?/, '/') : '';
    if (baseURL) {
        return baseURL + url;
    }

    baseURL = Buffer.from(Config.baseURL, 'hex').toString('utf8').replace(/\/+$/, '');
    return baseURL + url;
};

const convertBrowseURL = (alpha, range) => {
    range = (is.numeric(range) ? (
            parseInt(range) >= 500
                ? 100
                : (parseInt(range) < 1 ? 1 : parseInt(range))
        ) : 1);
    // [a-z]-([1-9]([0-9])?|100)
    browseURL = browseURL || Buffer.from(Config.baseBrowsURL, 'hex').toString('utf8');
    return browseURL + (is.string(alpha) ? alpha.toLowerCase() : 'a') + '-' + range;
};

const Request = (url, options) => new Promise((resolve, reject) => Client(url, options, (error, response, body) => resolve({error, response, body})));

const RequestSock = (url, host, port, options) => new Promise(
    (resolve, reject) => ClientSock5(
        url,
        options,
        host,
        port,
        (error, response, body) => resolve({error, response, body})
    )
);

let usedCountry = [];
let resultListURI = {};
proxyCrawl(Config.proxyCountry, 300).then(async (proxy) => {
    spinner.stop();
    let proxies = {};
    for (let key in proxy) {
        if (!proxy.hasOwnProperty(key)) {
            continue;
        }
        proxies[key] = [];
        for (let i =0; proxy[key].length > i ;i++) {
            if (proxy[key][i]['sock5']) {
                proxies[key].push(proxy[key][i]);
            }
        }
    }

    let cSockRequest = (
        url,
        proxyHost,
        proxyPort,
        options,
        errorCallback,
        resolveCallback
    ) => {
        spinner.start(
            `\n[Connect to : ${url} => Using Proxy: ${proxyHost}:${proxyPort}]`, 'cyan.italic'
        );
        Request(
            url,
            // proxyHost,
            // proxyPort,
            options
        ).then(
            ({error, response, body}) => {
                spinner.stop();
                if (response.statusCode === 404) {
                    errorCallback(404);
                    return;
                }
                if (error) {
                    errorCallback(error);
                    return;
                }
                body = $(body).find('ul a.pagination-companies');
                let result = [];
                body.each(function() {
                    if (this.href) {
                        let base = convertBaseURL(this.href);
                        result.push(base);
                    }
                });
                console.log(
                    '\nLOG:',
                    '\n' + result.join('\n') + '\n'
                );
                if (typeof resolveCallback === 'function') {
                    resolveCallback(result);
                }
            }
        ).catch((error) => {
            spinner.stop();
        });
    };

    let pos = 1;
    let code = Config.proxyCountry[0];
    let forProxy = () => {
        if (typeof proxies[code] !== 'object') {
            return null;
        }
        return typeof proxies[code][pos] === 'object'
            ? proxies[code][pos]
            : false;
    };

    let usedProxy = forProxy();
    let errCb = (a, r, resolveCallback, rejectCallback) => (error) => {
        if (error === 404) {
            rejectCallback(404);
            return;
        }

        console.error(clc.red('\nError: ' + error.message) + ' retrying ....');
        if (error !== true) {
            pos++;
            usedProxy = forProxy();
            if (!usedProxy) {
                for (let o = 0; Config.proxyCountry.length > o; o++) {
                    if (usedCountry.indexOf(Config.proxyCountry[o]) > -1
                    || code === Config.proxyCountry[o]
                    ) {
                        continue;
                    }

                    pos = -1;
                    code = Config.proxyCountry[o];
                }
            }

            if (!usedProxy) {
                pos++;
                usedProxy = forProxy();
            }

            if (!usedProxy) {
                console.warn(
                    '\n' + clc.cyan('-------------------------------------------------------'),
                    `\n\n\n         ${clc.red('PROCESS STOPPED! NO PROXY CAN BE USED')}\n\n`,
                    '\n' + clc.cyan('-------------------------------------------------------')
                    + '\n\n'
                );
                process.exit();
                return;
            }
        }

        cSockRequest(
            convertBrowseURL(a, r),
            usedProxy.ip,
            usedProxy.port,
            {},
            errCb(a, r, resolveCallback, rejectCallback)
        );
    };

    const writeData = (fileName, Data, callback) => {
        fs.open(fileName, 'w+', function (err, fd) {
            if (typeof callback !== 'function') {
                callback = () => {};
            }
            if (!err) {
                fs.write(fd, Data, callback);
                return;
            }
            callback();
        });
    };

    let ranges = new Array(100);
    let alphas = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let fn = (posAlpha, posRange) => new Promise((resolve, reject) => {
        cSockRequest(
            convertBrowseURL(alphas[posAlpha], posRange+1),
            usedProxy.ip,
            usedProxy.port,
            {},
            errCb(alphas[posAlpha], posRange+1, resolve, reject),
            resolve,
            reject
        );
    });

    let getRange = {};
    let fn2 = (a, b) => new Promise((res, rej) => fn(a, b).then((result) => {
        if (!is.array(resultListURI[a])) {
            resultListURI[a] = [];
        }
        for (let d =0; result.length > d;d++) {
            resultListURI[a].push(result[d]);
        }
        if (typeof getRange[a] === 'undefined') {
            getRange[a] = 0;
        }

        if (getRange[a] >= 98) {
            if (typeof alphas[a+1] === 'string') {
                // writeData(
                //     __dirname + '/Data/'+ alphas[a] +'.json',
                //     JSON.stringify(resultListURI[a], null, 4),
                //     function (err, fd) {
                //         fn2(a+1, 0);
                //     }
                // );
                fn2(a+1, 0);
                return;
            }

            res(result);
            return;
        }
        getRange[a] = b;
        fn2(a, b+1);
    }).catch((err) => {
        if (err === 404) {
            console.log(`End of result on found on ${alphas[a]} offset ${b} `);
            if (typeof alphas[a+1] === 'string') {
                // if (typeof resultListURI[a] !== 'undefined') {
                //     writeData(
                //         __dirname + '/Data/' + alphas[a] + '.json',
                //         JSON.stringify(resultListURI[a], null, 4),
                //         function (err, fd) {
                //             fn2(a+1, 0);
                //         }
                //     );
                // } else {
                    fn2(a+1, 0);
                // }
                return;
            } else {
                res('done');
            }
        }

        rej(err);
    }));

    fn2(0, 0).then((err) => {
        console.log(err);
        require('./ParseAllData')(resultListURI);
    }).catch((err) => {
        console.log(err);
        process.exit();
    });

    // console.log(res);
}).catch((err) => {
    console.log(err);
});
