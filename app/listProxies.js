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

const {proxyCrawl} = require('p-proxies').ProxySearch;

module.exports = (proxyCountry, cacheTime = 300, verbose = false) => new Promise((resolve, reject) => {
    if (typeof proxyCountry.length === "number" && proxyCountry.length === 0) {
        resolve({});
        return;
    }

    proxyCrawl(proxyCountry, cacheTime, verbose)
        .then((proxy) => {
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
            resolve(proxy);
        }).catch((err) => {
            reject(err);
        })
});
