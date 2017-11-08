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

const is = require('./is');
const baseURLH = '68747470733a2f2f7777772e6a6f627374726565742e636f2e6964';
const baseBrowseURLH = '68747470733a2f2f7777772e6a6f627374726565742e636f2e69642f656e2f636f6d70616e6965732f62726f7773652d';
let baseURL = null;
let browseURL  = null;

const convertBaseURL = (url) => {
    url = is.string(url) ? url.replace(/^\/?/, '/') : '';
    if (baseURL) {
        return baseURL + url;
    }

    baseURL = Buffer.from(baseURLH, 'hex').toString('utf8').replace(/\/+$/, '');
    return baseURL + url;
};

const convertBrowseURL = (alpha, range) => {
    range = (is.numeric(range) ? (
        // max = 100
        parseInt(range) >= 100
            ? 100
            : (parseInt(range) < 1 ? 1 : parseInt(range))
    ) : 1);

    // [a-z]-([1-9]([0-9])?|100)
    browseURL = browseURL || Buffer.from(baseBrowseURLH, 'hex').toString('utf8');
    return browseURL + (is.string(alpha) ? alpha.toLowerCase() : 'a') + '-' + range;
};

const convertCompanyseURL = (url) => {
    url = is.string(url) ? url.replace(/^\/+/, '') : '';
    return convertBaseURL('/en/companies/' + url);
};

module.exports = {
    baseURL: baseURLH,
    baseBrowseURL: baseBrowseURLH,
    convertBaseURL,
    convertBrowseURL,
    convertCompanyseURL
};
