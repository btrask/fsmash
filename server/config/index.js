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
var config = exports;
var configDir = __dirname;

var fs = require("fs");
var path = require("path");

var deepMerge = function(obj1, obj2, etc) {
	var r = arguments[0], i, obj, prop;
	if(Object !== r.constructor) return false;
	for(i = 1; i < arguments.length; ++i) {
		obj = arguments[i];
		for(prop in obj) if(obj.hasOwnProperty(prop)) {
			if(!r.hasOwnProperty(prop) || !deepMerge(r[prop], obj[prop])) r[prop] = obj[prop]
		}
	}
	return true;
};
var readdir = function(sync, path, callback) {
	if(!sync) return fs.readdir(path, callback);
	var err, filenames;
	try {
		filenames = fs.readdirSync(path);
	} catch(e) {
		err = e;
	}
	callback(err, filenames);
};
var readfile = function(sync, path, encoding, callback) {
	if(!sync) return fs.readFile(path, encoding, callback);
	var err, data;
	try {
		data = fs.readFileSync(path, encoding)
	} catch(e) {
		err = e;
	}
	callback(err, data);
};

var update = function(sync, callback) {
	readdir(sync, configDir, function(err, filenames) {
		if(err) return;
		filenames.sort();
		(function next() {
			if(!filenames.length) return (callback || function(){})();
			var name = filenames.shift();
			if(".json" !== path.extname(name)) return next();
			readfile(sync, path.join(configDir, name), "utf8", function(err, data) {
				if(!err) deepMerge(config, JSON.parse(data));
				next();
			});
		})();
	});
};
update(true);
config.update = function() {
	update(false);
};
