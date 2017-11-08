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

const is = require('../src/is');
const clc = new require('cli-color');
const {convertBrowseURL} = require('../src/url');
const cSockRequest = require('./requestRequest');
const redis = require('redis');
const redisClient = redis.createClient();
const sha1 = require('../src/sha1');
let keyProxyCache = 'jbinc:proxy_' + sha1('current_proxy');
let usedCountry = [];
let ObjectURI = {};
module.exports = (proxyCountry, Proxies, options = {}) => new Promise((resolver, rejected) => {
    if (!is.array(proxyCountry)) {
        rejected(new Error('Proxy country lists must be as array list'));
        return;
    }
    if (!is.object(Proxies)) {
        rejected(new Error('Proxy list must be as object proxies'));
        return;
    }

    const startPosition = 1;
    const ranges = new Array(100);
    let alphas = [];
    if (is.array(global['alpha'])) {
        alphas = global['alpha'];
    } else {
        alphas = 'abcdefghijklmnopqrstuvwxyz'.split('');
        // add 1
        alphas.unshift('more');
    }

    // var
    let currentIncrementRanges = {};
    let getCurrentProxy = () => {
        if (
            currentCode
            && typeof Proxies[currentCode] === 'object'
            && typeof Proxies[currentCode][currentOffset] === 'object'
        ) {
            Proxies[currentCode][currentOffset]['code'] = currentCode;
            return Proxies[currentCode][currentOffset];
        }

        return false;
    };

    let lastProxy = null;
    let currentOffset = 0;
    let currentCode = proxyCountry[0];
    let lastHash = {};
    let Proxy = getCurrentProxy();
    redisClient.get(keyProxyCache, function (err, value) {
        if (is.string(value)) {
            try {
                value = JSON.parse(value);
                if (is.object(value)) {
                    currentOffset = -1;
                    Proxy = value;
                }
            } catch (err) {
            }
        }
    });

    let proxyMustBeSkipped = false;
    let retry = 0;
    const createIncrementCurrentProxy = () => {
        currentOffset++;
        Proxy = getCurrentProxy();
        if (!Proxy) {
            for (let increment = 0; proxyCountry.length > increment; increment++) {
                if (usedCountry.indexOf(proxyCountry[increment]) > -1) {
                    continue;
                }
                if (currentCode === proxyCountry[increment]) {
                    delete Proxies[currentCode];
                    continue;
                }

                currentOffset = -1;
                currentCode = proxyCountry[increment];
                // stop
                break;
            }
        } else if (typeof Proxies[currentCode] === 'object'
            && typeof Proxies[currentCode][currentOffset - 1] === 'object'
        ) {
            delete Proxies[currentCode][currentOffset - 1];
        }

        if (!Proxy) {
            currentOffset++;
            Proxy = getCurrentProxy();
            if (typeof Proxies[currentCode] === 'object'
                && typeof Proxies[currentCode][currentOffset - 1] === 'object'
            ) {
                delete Proxies[currentCode][currentOffset - 1];
                // set cache
            }
        }

        return Proxy;
    };

    /**
     * Error CallBack Resolver
     *
     * @param posAlpha
     * @param posRange
     * @param resolve
     * @param reject
     * @param errorResolver
     */
    let errorCallBackResolver = (posAlpha,
                                 posRange,
                                 resolve,
                                 reject,
                                 errorResolver) => (error) => {
        if (error === 404) {
            reject(404);
            return;
        }

        let needToHandle = false;
        let isTimeOut = false;
        if (error.message.toString().match(/ECONNREFUSED/)) {
            needToHandle = true;
            if (global.verbose) {
                console.error(clc.red('☴  Error  : ') + 'Socket connection refused');
            }
        } else if (error.message.toString().match(/authentication\s*failed/i)) {
            if (global.verbose) {
                console.error(clc.red('☴  Error  : ') + 'Need proxy authentication');
            }
        } else {
            switch (error.message) {
                case 'ETIMEDOUT':
                case 'ESOCKETTIMEDOUT':
                    if (global.verbose) {
                        console.error(clc.red('☴  Error  : ')
                            + (
                                error.message === 'ETIMEDOUT'
                                ? 'Request '
                                : 'Socket '
                            )
                            + 'connection time out');
                    }
                    isTimeOut = true;
                    needToHandle = true;
                    break;
                default:
                    if (global.verbose) {
                        console.error(clc.red('☴  Error  : ') + (error.message));
                    }
                    break;
            }
        }

        if (!proxyMustBeSkipped) {
            if (!isTimeOut || retry > 9) {
                Proxy = createIncrementCurrentProxy();
            }
        }

        if (!getCurrentProxy()) {
            proxyMustBeSkipped = true;
        }

        if (error) {
            if (needToHandle) {
                if (retry > 9) {
                    let oldRetry = retry;
                    retry = 0;
                    if (!Proxy) {
                        reject(new Error(`Error: ${error.message} Unhandled after ${oldRetry + 1} request`));
                    }
                    lastProxy = null;
                    redisClient.del(keyProxyCache);
                    errorResolver(posAlpha, posRange, resolve, reject);
                    return;
                }
                retry++;
                console.error(clc.blue('☴  Worker : ') + clc.italic(`Retrying ${retry} times .....`));
                // reject(new Error('Proxy has empty!'));
                errorResolver(posAlpha, posRange, resolve, reject);
                return;
            }
            if (!Proxy) {
                // if got error and unhandled
                reject(error);
                return;
            }
        }

        console.error(clc.blue('☴  Worker : ') + clc.italic(`Retrying .....`));
        errorResolver(posAlpha, posRange, resolve, reject);
    };

    const createCSocksRequest = (posAlpha, posRange, resolve, reject) => {
        let currentURI = convertBrowseURL(alphas[posAlpha], posRange);
        let proxyHost = Proxy && Proxy.ip ? Proxy.ip : null;
        let proxyPort = Proxy && Proxy.port ? Proxy.port : null;
        let isUseProxy = !!(proxyHost && proxyPort);
        let req = () => {
            cSockRequest(
                currentURI,
                options,
                errorCallBackResolver(
                    posAlpha,
                    posRange,
                    (args) => {
                        retry = 0;
                        return resolve(args);
                    },
                    reject,
                    (posAlpha, posRange) => {
                        createCSocksRequest(posAlpha, posRange, (args) => {
                            retry = 0;
                            return resolve(args);
                        }, reject)
                    }
                ),
                (args) => {
                    retry = 0;
                    return resolve(args);
                },
                isUseProxy ? proxyHost : null,
                isUseProxy ? proxyPort : null
            );
        };
        redisClient.get(sha1(currentURI), (error, value) => {
            if (error || !is.string(value)) {
                req();
                return;
            }
            try {
                value = JSON.parse(value);
            } catch (err) {
                req();
                return;
            }
            console.info(`☴  Cache  : ${clc.cyan(`Found for ${currentURI}`)}`);
            resolve(value);
        });
    };

    let callInit = (posAlpha, posRange) => (new Promise(
            (resolve, reject) => {
                createCSocksRequest(
                    posAlpha,
                    (posRange < startPosition ? startPosition : posRange),
                    resolve,
                    reject
                )
            }).then((result) => {
            let cProxy = getCurrentProxy();
            if (cProxy && cProxy !== lastProxy) {
                lastProxy = cProxy;
                redisClient.set(keyProxyCache, JSON.stringify(lastProxy), 'EX', 3600);
            }
            let currentAlphabet = alphas[posAlpha];
            if (!is.object(ObjectURI[currentAlphabet])) {
                ObjectURI[currentAlphabet] = {};
            }
            let counted = 0;
            for (let name in result) {
                if (!result.hasOwnProperty(name)) {
                    continue;
                }
                counted++;
                ObjectURI[currentAlphabet][name] = result[name];
            }

            if (currentAlphabet === 'more') {
                typeof alphas[posAlpha + 1] !== 'string'
                    ? resolver({ObjectURI, Proxy, Proxies})
                    : callInit(posAlpha + 1, startPosition);
                return;
            }

            // check hash
            let currentHash = sha1(JSON.stringify(ObjectURI[currentAlphabet]));
            if (typeof lastHash[currentAlphabet] !== 'undefined' && currentHash === lastHash[currentAlphabet]) {
                console.log(
                    '☴  Skipped : ' + clc.cyan(`Request data has identical with previous result\n`)
                );

                typeof alphas[posAlpha + 1] !== 'string'
                    ? resolver({ObjectURI, Proxy, Proxies})
                    : callInit(posAlpha + 1, startPosition);
                return;
            }

            lastHash[currentAlphabet] = currentHash;
            if (global.verbose) {
                console.log(
                    '☴  Found  : ' + clc.cyan(`[${clc.blue(counted)}] total data with alpha: [${clc.blue(alphas[posAlpha])}], in page: [${clc.blue(posRange)}]\n`)
                );
            }

            if (typeof currentIncrementRanges[posAlpha] === 'undefined') {
                currentIncrementRanges[posAlpha] = startPosition;
            }

            if (currentIncrementRanges[posAlpha] >= (ranges.length - 1)) {
                typeof alphas[posAlpha + 1] !== 'string'
                    ? resolver({ObjectURI, Proxy, Proxies})
                    : callInit(posAlpha + 1, startPosition);
                return;
            }

            currentIncrementRanges[posAlpha] = posRange;
            callInit(posAlpha, posRange + 1);
        }).catch((error) => {
            if (error !== 404) {
                rejected(error);
                return;
            }
            typeof alphas[posAlpha + 1] !== 'string'
                ? resolver({ObjectURI, Proxy, Proxies})
                : callInit(posAlpha + 1, startPosition);
        })
    );

    callInit(0, startPosition);
});
