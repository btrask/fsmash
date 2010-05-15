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
var mime = exports;

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var table = JSON.parse(fs.readFileSync(__dirname+"/mime.json"));

mime.lookup = function(str, callback) {
	var ext = path.extname(str).slice(1), type;
	if(table.hasOwnProperty(ext)) type = table[ext];
	callback(type || "application/octet-stream");
};
