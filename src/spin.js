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
const spin = require('cli-spinner').Spinner;
const clc = require('cli-color');

let onProcess = false;
// set default spinner
spin.setDefaultSpinnerString(21);
process.on('SIGINT', () => {
    if (onProcess) {
        process.stdout.write('\x1b[?25h\n\n');
    }
    process.exit();
});

spin.prototype.start = function(text, color, periodLength = 3, spinnerType = 21) {
    periodLength = is.boolean(periodLength) ? 3 : periodLength;
    periodLength = is.number(periodLength)
        && periodLength > 0
        ? periodLength
        : 0;
    if (is.string(text)) {
        this.text = text;
    }
    if (is.number(spinnerType)) {
        this.setSpinnerString(spinnerType);
    }
    if (is.contain(color, '.')) {
        let cArray = color.split('.');
        if (cArray.length > 1) {
            let fn = clc;
            let found = false;
            for (let i = 0; cArray.length > i;i++) {
                if (is.fn(fn[cArray[i]])) {
                    fn = fn[cArray[i]];
                    found = true;
                    continue;
                }
                found = false;
            }
            if (found) {
                color = fn;
            }
        }
    }

    let match = this.text.match(/^([\n]+)/);
    let newLine = match && match[1] ? match[1] : false;

    this.text = this.text
        .replace(/^\n/, '')
        .replace(/\n/, ' ')
        .replace(/^\s+/, '');
    color = is.fn(color)
        ? color
        : (is.fn(clc[color]) ? clc[color]: (t) => {return t});
    this.text = ' ' + color(this.text);
    let current = 0;
    let self = this;
    let period = 0;
    let period2 = 0;
    let lastText = '';
    periodLength = periodLength ? periodLength+1 : 0;
    if (newLine) {
        process.stdout.write(newLine);
    }
    onProcess = true;
    process.stdout.write('\x1b[?25l');
    this.id = setInterval(function() {
        let msg = self.text.indexOf('%s') > -1
            ? self.text.replace('%s', self.chars[current])
            : self.chars[current] + ' ' + self.text;
        if (periodLength) {
            if (! period2 || period2 > 4) {
                if (period % periodLength === 0) {
                    msg = msg.replace(/[.]{1,3}/, '');
                    lastText = '';
                    period = 0;
                } else if (period < periodLength) {
                    lastText = ' ' + color('.'.repeat(period));
                }
                period++;
                period2 = 0;
            }
            period2++;
        }

        self.onTick(msg + lastText);
        current = ++current % self.chars.length;
    }, this.delay);

    return this;
};
spin.prototype.stop = function(clear) {
    onProcess = false;
    process.stdout.write('\x1b[?25h\n');
    clearInterval(this.id);
    this.id = undefined;
    if (clear) {
        this.clearLine(this.stream);
    }
    return this;
};

const spinner = new spin();

module.exports = spinner;
