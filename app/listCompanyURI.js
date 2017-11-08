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
    const ranges      = new Array(100);
    const alphas      = 'abcdefghijklmnopqrstuvwxyz'.split('');
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

    let currentOffset   = 0;
    let currentCode     = proxyCountry[0];
    let Proxy = getCurrentProxy();

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
            && typeof Proxies[currentCode][currentOffset -1] === 'object'
        ) {
            delete Proxies[currentCode][currentOffset -1];
        }

        if (!Proxy) {
            currentOffset++;
            Proxy = getCurrentProxy();
            if (typeof Proxies[currentCode] === 'object'
                && typeof Proxies[currentCode][currentOffset -1] === 'object'
            ) {
                delete Proxies[currentCode][currentOffset -1];
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
    let errorCallBackResolver = (
        posAlpha,
        posRange,
        resolve,
        reject,
        errorResolver
    ) => (error) => {
        if (error === 404) {
            reject(404);
            return;
        }
        if (global.verbose) {
            if (error.message.toString().match(/ECONNREFUSED/)) {
                console.error(clc.red('\nError: Socket connection refused') + ' retrying ....');
            } else {
                switch (error.message) {
                    case 'ESOCKETTIMEDOUT':
                        console.error(clc.red('\nError: Socket connection time out') + ' retrying ....');
                        break;
                    default:
                        console.error(clc.red('\nError: ' + error.message) + ' retrying ....');
                        break;
                }
            }
        }

        Proxy = createIncrementCurrentProxy();
        if (error !== true && ! Proxy) {
            // reject(new Error('Proxy has empty!'));
            errorResolver(posAlpha, posRange, resolve, reject);
            return;
        }

        errorResolver(posAlpha, posRange, resolve, reject);
    };

    const createCSocksRequest = (posAlpha, posRange, resolve, reject) => {
        cSockRequest(
            convertBrowseURL(alphas[posAlpha], posRange),
            options,
            errorCallBackResolver(
                alphas[posAlpha],
                posRange,
                resolve,
                reject,
                (posAlpha, posRange) => {
                    createCSocksRequest(posAlpha, posRange, resolve, reject)
                }
            ),
            resolve,
            Proxy ? Proxy.ip : null,
            Proxy ? Proxy.port : null
        );
    };

    let callInit = (posAlpha, posRange) => (new Promise(
        (resolve, reject) => createCSocksRequest(
            posAlpha,
            (posRange < startPosition ? startPosition : posRange),
            resolve,
            reject
        )).then((result) => {

            let currentAlphabet = alphas[posAlpha];
            if (!is.array(ObjectURI[currentAlphabet])) {
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

            if (global.verbose) {
                console.log(
                    clc.blue(`\n# Found: (${counted}) total data on alpha: (${alphas[posAlpha]}), and page: (${posRange})`)
                );
            }

            if (typeof currentIncrementRanges[posAlpha] === 'undefined') {
                currentIncrementRanges[posAlpha] = startPosition;
            }

            if (currentIncrementRanges[posAlpha] >= (ranges.length-1)) {
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

    // init
    callInit(0, startPosition);
});
