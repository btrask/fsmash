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

var fs = require("fs");
var http = require("http");
var path = require("path");
var sys = require("sys");
var url = require("url");

var bt = require("../../shared/bt");

var MIMEForExtension = (function() {
	var MIMEByExt = JSON.parse(fs.readFileSync(__dirname+"/mime.json", "utf8"));
	return function(ext) {
		return MIMEByExt[ext.slice(1)] || "application/octet-stream";
	};
})();

wrapper.createServer = function(dispatcher, unknownHandler/* (filename, write (status, header, data, encoding)) */) {
	return http.createServer(function(req, res) {
		var data = "";
		req.setEncoding("utf8");
		req.addListener("data", function(chunk) {
			data += chunk;
		});
		req.addListener("end", function() {
			var filename = url.parse(req.url).pathname;
			var write = function(status, header, data, encoding) {
				res.writeHead(status, header);
				res.end(data, encoding);
			};
			var unknown = function(req, res, filename) {
				return unknownHandler(filename, write);
			};
			try {
				var result = dispatcher(unknown, bt.components(filename), req, data);
				if("function" === typeof result) result(req, res, filename);
				else wrapper.writeJSON(req, res, result);
			} catch(err) {
				var msg = "500 Internal Server Error";
				write(500, {
					"Content-Type": "text/plain; charset=UTF-8",
					"Content-Length": msg.length,
				}, msg, "utf8");
				sys.log(err);
			}
		});
	});
};
wrapper.createClient = function(arg1, arg2, etc) {
	return http.createClient.apply(http, arguments);
};
wrapper.createFileHandler = function(rootdir) {
	var pendingLookups = null;
	var cacheByDisplayName = {};
	var scandir = function(dirname, callback) {
		fs.readdir(dirname, function(err, filenames) {
			if(err) {
				if(err.errno != process.ENOTDIR) return callback();
				return scanfile(dirname, callback);
			}
			(function recurseOverFilenames(i) {
				if(i >= filenames.length) return callback();
				scandir(path.join(dirname, filenames[i]), bt.curry(recurseOverFilenames, i + 1));
			})(0);
		});
	};
	var scanfile = function(filename, callback) {
		var displayName = filename.slice(rootdir.length);
		var ext = path.extname(displayName), compression, type;
		switch(ext) {
			case ".gz":
				compression = "gzip";
				displayName = displayName.slice(0, -ext.length);
				ext = path.extname(displayName);
				break;
			default:
				if(cacheByDisplayName.hasOwnProperty(displayName)) return callback();
				compression = "identity";
				break;
		}
		type = MIMEForExtension(ext);
		if("text/" === type.slice(0, 5)) type += "; charset=UTF-8";
		fs.readFile(filename, function(err, data) {
			if(!err) cacheByDisplayName[displayName] = {
				status: 200,
				header: {
					"Content-Type": type,
					"Content-Length": data.length,
					"Content-Encoding": compression,
				},
				body: data,
			};
			callback();
		});
	};
	var fileHandler = function(filename, write/* (status, header, data, encoding) */) {
		if("/" === filename[filename.length - 1]) filename += "index.html";
		var lookup = cacheByDisplayName.hasOwnProperty(filename) ? function() {
			var cache = cacheByDisplayName[filename];
			write(cache.status, cache.header, cache.body, cache.encoding);
		} : function() {
			var msg = "404 File Not Found";
			write(404, {
				"Content-Type": "text/plain; charset=UTF-8",
				"Content-Length": msg.length,
			}, msg, "utf8");
		};
		if(null === pendingLookups) lookup();
		else pendingLookups.push(lookup);
	};
	fileHandler.rescan = function() {
		if(null !== pendingLookups) return false;
		pendingLookups = [];
		cacheByDisplayName = {};
		scandir(rootdir, function() {
			for(var i = 0; i < pendingLookups.length; ++i) pendingLookups[i]();
			pendingLookups = null;
		});
		return true;
	};
	rootdir = path.normalize(rootdir);
	fileHandler.rescan();
	return fileHandler;
};
wrapper.writeJSON = function(req, res, value) {
	var body = JSON.stringify(value);
	if(!body) body = "";
	res.writeHead(200, {
		"Content-Type": "text/json; charset=UTF-8",
		"Content-Length": body.length,
	});
	res.end(body, "utf8");
};
