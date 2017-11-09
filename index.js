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
// dev only
// global.alpha = ['a'];
global.verbose = true;
const proxyCountry = [
    // 'SG',
    // 'HK',
    // 'US',
    // 'ID',
    // 'TW',
    // 'AU',
    // 'DE',
    // 'CA',
    // 'UK'
];

/*!
 * SYNC PARSE
 */
global.spinner = new require('./src/spin');
let spinner = global.spinner;
spinner.setDefaultSpinnerString(17);
spinner.setSpinnerDelay(30);

const is = require('./src/is');
const {RequestSock, Request} = require('./src/request');
const cSockRequest = require('./app/requestRequest');
const {convertBrowseURL, convertBaseURL} = require('./src/url');
const writeData = require('./src/writer');
const sha1 = require('./src/sha1');

const clc = new require('cli-color');
const redisClient = require('redis').createClient();
const {$} = require('p-proxies').jQuery;
const fs = require('fs');
const companyPath = __dirname + '/Data/CompanyURL.json';

/** @type Promise */
const ProxyCall = require('./app/listProxies');
/** @type Promise */
const CompaniesURI = require('./app/listCompanyURI');


let nocache = true;
for (let i = 2; process.argv.length > i; i++) {
    nocache = !!(typeof process.argv[i] === 'string' && process.argv[i].toLowerCase().match(/no-?cache/i));
}

const processorCompanies = (proxyCountry) => (proxies) => {
    if (global.verbose) {
        spinner.stop();
        console.log('');
        for (let code in proxies) {
            if (!proxies.hasOwnProperty(code)) {
                continue;
            }
            console.log('☴  Found  : ' + clc.cyan(`proxy code[${code}] with ${proxies[code].length} total.`));
        }
        console.log('-----------------------------------------');
    }
    if (!nocache) {
        try {
            let stats = fs.statSync(companyPath);
            if (1 === 1) { //((new Date().getTime() - stats.mtime) / 1000) < 24 * 3600 * 3) {
                let ObjectURI = fs.readFileSync(companyPath);
                ObjectURI = JSON.parse(ObjectURI.toString());
                let Proxy = null;
                for (let code in proxies) {
                    if (proxies.hasOwnProperty(code)) {
                        Proxy = proxies[code];
                        Proxy['code'] = code;
                        break;
                    }
                }
                process.stdout.write('☴  Data   : '+ clc.cyan(`Uses cache data as source`));
                return (new Promise((resolve, reject) => resolve(ObjectURI))).then((ObjectURI) => {
                    return {ObjectURI, Proxy, Proxies: proxies};
                });
            }
        } catch (err) {
            // console.log(err);
            // process.exit();
            // pass
        }
    }

    return CompaniesURI(
        proxyCountry,
        proxies,
        {
            timeout: 7000,
            socketTimeOut: 1500,
        }
    ).then(({ObjectURI, Proxy, Proxies}) => {
        return {ObjectURI, Proxy, Proxies};
    });
};

const processorData = ({ObjectURI, Proxy, Proxies}) => {
    if (!global.verbose) {
        spinner.start('Processing all available companies', 'blue.bold.italic');
    }

    let proxies = {};
    for (let code in Proxies) {
        if (!Proxies.hasOwnProperty(code)) {
            continue;
        }
        for (let increment = 0; Proxies[code].length > increment;increment++) {
            if (is.object(Proxies[code][increment])) {
                if (!is.array(proxies[code])) {
                    proxies[code] = [];
                }
                proxies[code].push(Proxies[code][increment]);
            }
        }
        // clear
        delete Proxies[code];
    }

    let key = sha1(JSON.stringify(proxyCountry));
    redisClient.set(key, JSON.stringify(proxies), 'EX', 3600);

    return require('./app/listData')(ObjectURI, Proxy, proxies);
};

const Proxy = (proxyCountry, cacheTime) => {
    let key = sha1(JSON.stringify(proxyCountry));
    return new Promise((resolve, reject) => redisClient.get(key, (err, value) => {
        if (err) {
            resolve(ProxyCall(proxyCountry, cacheTime));
            return;
        }
        try {
            let Proxies = JSON.parse(value.toString());
            if (is.object(Proxies)) {
                resolve(new Promise((resolve, reject) => resolve(Proxies)));
            }
        } catch (err) {
            // pass
        }
        resolve(ProxyCall(proxyCountry, cacheTime));
    }));
};

spinner.start('\nGetting Proxy List', 'blue.bold.italic');
Proxy(proxyCountry, 3600)
    .then((proxies) => {
        spinner.stop();
        if (!global.verbose) {
            spinner.start('Getting company URL', 'blue.bold.italic');
        }
        return processorCompanies(proxyCountry)(proxies)
    })
    .then(({ObjectURI, Proxy, Proxies}) => {
        spinner.stop();
        writeData(
            companyPath,
            JSON.stringify(ObjectURI, null, 2),
            () => {
                return processorData({ObjectURI, Proxy, Proxies})
                    .then(() => {
                        spinner.stop();
                        process.exit();
                    })
                    .catch((err) => {
                        spinner.stop();
                        console.log(err);
                        process.exit();
                    })
            }
        );
    })
    .catch((err) => {
        spinner.stop();
        console.log(err);
        process.exit();
    });
