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
 * furnished to do so, subject to the following conditions =
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
let Is = function () {
    if(!(this instanceof Is))
        return new Is;

    this.is = this;
    this.Is = this.is;
    this.boolean = (arg) => typeof arg === 'boolean';
    this.bool = this.boolean;
    this.float = (arg) => this.number(arg) && (arg%1) !== 0;
    this.int  = (arg) => this.number(arg) && (arg%1) === 0;
    this.integer = this.int;
    this.string = (arg) => typeof arg === 'string';
    this.number = (arg) => typeof arg === 'number';
    this.numeric = (arg) => this.number(arg) || this.float(arg) || this.string(arg) && !(arg.match(/[^0-9]/));
    this.nill   = (arg) => arg === null;
    this.null   = this.nill;
    this.array  =  (arg) => this.objectTypeof(arg) === '[object Array]';
    this.object = (arg) => this.objectTypeof(arg) === '[object Object]';
    this.callable = this.fn;
    this.array_search = (offset, array) => {
        if (this.undefined(offset) || !this.array(array)) {
            return false;
        }
        offset = array.indexOf(offset);
        return offset > -1 ? offset : false;
    };
    this.array_key_exists = (offset, array) => {
        return this.array_search(offset, array) !== false;
    };
    this.undefined = (arg) => typeof arg === 'undefined';
    // alias
    this.fn =     (arg) => typeof arg === 'function';
    this.commonObject = (arg) => typeof arg === 'object';
    this.objectTypeof = (arg) => this.commonObject(arg) ? Object.prototype.toString.call(arg) : null;
    this.contain      = (str, arg, caseInsensitive) => {
        if (!this.string(str) || !this.string(arg)) {
            return false;
        }
        let re = new RegExp(arg, `${caseInsensitive ? 'i' : ''}g`);
        return !(!re.test(str));
    };

    return this;
};

module.exports = new Is;
