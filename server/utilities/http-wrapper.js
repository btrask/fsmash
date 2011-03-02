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

var constants = require("constants");
var fs = require("fs");
var http = require("http");
var path = require("path");
var url = require("url");
var util = require("util");

var bt = require("../../shared/bt");
var config = require("../config/");

var MIMEForExtension = function(ext, charset) {
	var type = config.mime[ext.slice(1)] || "application/octet-stream";
	if(charset && "text/" === type.slice(0, 5)) type += "; charset=" + charset;
	return type;
};
var writeError = function(status, message, write/* (status, header, data, encoding) */) {
	var msg = new Buffer("" + status + " " + message, "utf8");
	write(status, {
		"Content-Type": "text/plain; charset=UTF-8",
		"Content-Length": msg.length,
	}, msg);
};

wrapper.createServer = function(dispatcher, unknownHandler/* (req, filename, write (status, header, data, encoding)) */) {
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
				return unknownHandler(req, filename, write);
			};
			try {
				var result = dispatcher(unknown, bt.components(filename), req, data);
				if("function" === typeof result) result(req, res, filename);
				else wrapper.writeJSON(req, res, result);
			} catch(err) {
				writeError(500, "Internal Server Error", write);
				util.log(err.stack);
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
				if(err.errno != constants.ENOTDIR) return callback();
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
		type = MIMEForExtension(ext, "UTF-8");
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
	var fileHandler = function(req, filename, write/* (status, header, data, encoding) */) {
		if("/" === filename[filename.length - 1]) filename += "index.html";
		var lookup = function() {
			if(cacheByDisplayName.hasOwnProperty(filename)) {
				var cache = cacheByDisplayName[filename];
				write(cache.status, cache.header, cache.body, cache.encoding);
			} else {
				writeError(404, "File Not Found", write);
			}
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
	var body = new Buffer(JSON.stringify(value/*, undefined, "\t"*/), "utf8");
	if(!body) body = "";
	res.writeHead(200, {
		"Content-Type": "text/json; charset=UTF-8",
		"Content-Length": body.length,
	});
	res.end(body);
};
