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

const {RequestSock, Request} = require('../src/request');
const {convertBaseURL} = require('../src/url');
/**
 * @type {{jQuery}}
 */
const {$} = require('p-proxies').jQuery;

if (typeof global.spinner === 'undefined') {
    global.spinner = new require('./src/spin');
}
let verbose = typeof global.verbose !== 'undefined'
    && global.verbose;
const jSelector = 'ul a.pagination-companies';
const Resolver = (body) => {
    body = $(body).find(jSelector);
    let result = {};
    body.each(function() {
        if (typeof $(this).attr('href') === 'string') {
            let base  = $(this).attr('href').toString().replace(/^\/+/, '');
            if (base === '') {
                return;
            }
            base = base.replace(/^(\/+)?[^\/]+\/[^\/]+\//, '');
            let inner = $(this).contents().text() || '';
                inner = inner.replace(/(\s)+/g, '$1').replace(/^\s+|\s+$/, '');
            result[base] = inner;
        }
    });

    return result;
};

let cSockRequest = (
    url,
    options,
    errorCallback,
    resolveCallback,
    proxyHost = null,
    proxyPort = null
) => {
    let isUseProxy = !!(proxyPort && proxyHost);
    let methodRequest = isUseProxy ? RequestSock : Request;
    if (verbose) {
        spinner.start(
            (isUseProxy
                    ? `\nConnect to : [${url}] Using Proxy: [${proxyHost}:${proxyPort}]`
                    : `\nConnect to : [${url}] Without Proxy`
            ),
            'cyan.italic'
        );
    }

    methodRequest(
        url,
        options,
        proxyHost,
        proxyPort
    ).then(
        ({error, response, body}) => {
            if (verbose) {
                spinner.stop();
            }
            if (typeof errorCallback !== "function") {
                errorCallback = () => {};
            }
            if (typeof resolveCallback !== "function") {
                resolveCallback = () => {};
            }

            if (response && response.statusCode === 404) {
                errorCallback(404);
                return;
            }
            if (error) {
                errorCallback(error);
                return;
            }
            let result = Resolver(body);
            if (typeof resolveCallback === 'function') {
                resolveCallback(result);
            }
        }
    ).catch((error) => {
        if (verbose) {
            spinner.stop();
        }
        errorCallback(error);
    });
};

module.exports = cSockRequest;