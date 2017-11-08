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

'use strict';

/*jshint node:true*/

let tls = require('tls');
let https = require('https');
let inherits = require('util').inherits;

let socksClient = require('socks5-client');

function createConnection(options) {
    let socksSocket, onProxy;

    socksSocket = socksClient.createConnection(options);
    socksSocket.socket.setTimeout(
        typeof options.timeout === "number"
            ? options.timeout
            : 2000,
        function () {
            this.emit('error', new Error('ESOCKETTIMEDOUT'));
            this.destroy();
        }
    );
    onProxy = socksSocket.onProxied;
    socksSocket.onProxied = function() {
        options.socket = socksSocket.socket;

        if (options.hostname) {
            options.servername = options.hostname;
        } else if (options.host) {
            options.servername = options.host.split(':')[0];
        }

        socksSocket.socket = tls.connect(options, function() {

            // Set the 'authorized flag for clients that check it.
            socksSocket.authorized = socksSocket.socket.authorized;
            onProxy.call(socksSocket);
        });

        socksSocket.socket.on('error', function(err) {
            socksSocket.emit('error', err);
        });
    };

    return socksSocket;
}

function Agent(options) {
    https.Agent.call(this, options);

    this.socksHost = options.socksHost || 'localhost';
    this.socksPort = options.socksPort || 1080;

    this.createConnection = createConnection;
}

inherits(Agent, https.Agent);

module.exports = Agent;
