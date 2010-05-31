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
wrapper.randomString = function(length) {
	var str = "";
	while(str.length < length) str += Math.random().toString(36).slice(2);
	return str.substring(0, length);
};
