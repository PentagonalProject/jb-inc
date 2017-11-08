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

const {Client} = require('p-proxies').Request;
const Socks5ClientHttpsAgent = require('socks5-https-client/lib/Agent');

const RequestSock = (url, options = {}, proxyHost, proxyPort) => {
    let socketOpt = {
        socksHost: proxyHost,
        socksPort: proxyPort
    };
    if (typeof options.socketTimeOut === "number") {
        socketOpt.timeout = options.socketTimeOut;
        delete options.socketTimeOut;
    } else if (typeof options.timeout === "number") {
        socketOpt.timeout = options.timeout;
    }

    options.agent = new Socks5ClientHttpsAgent(socketOpt);
    return new Promise(
        (resolve, reject) => Client(
            url,
            options,
            (error, response, body) => resolve({error, response, body})
        )
    );
};

const Request = (url, options) => new Promise(
    (resolve, reject) => Client(
        url,
        options,
        (error, response, body) => resolve({error, response, body})
    )
);

module.exports = {
    Request,
    RequestSock
};