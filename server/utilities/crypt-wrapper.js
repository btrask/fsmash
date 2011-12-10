/* Copyright (C) 2010 Ben Trask

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */
var wrapper = exports;
var crypt = require("crypt");

wrapper.hash = function(password, prefix, count, input) {
	return crypt.crypt(password, crypt.gensalt((prefix || crypt.BLOWFISH), (count || 8), (input || wrapper.randomString(16))));
};
wrapper.check = function(password, hash) {
	return crypt.crypt(password, hash) === hash;
};
wrapper.randomString = function(length, charset) {
	var chars = [], i;
	charset = charset || "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
	for(i = 0; i < length; ++i) chars.push(charset[Math.floor(Math.random() * charset.length)]);
	return chars.join("");
};
