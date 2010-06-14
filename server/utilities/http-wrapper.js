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

var MIMEForPath = (function() {
	var MIMEByExt = JSON.parse(fs.readFileSync(__dirname+"/mime.json", "utf8"));
	return function(str, callback) {
		var ext = path.extname(str).slice(1), MIME;
		if(MIMEByExt.hasOwnProperty(ext)) MIME = MIMEByExt[ext];
		callback(MIME || "application/octet-stream");
	};
})();

wrapper.createServer = function(dispatcher, unknownHandler/* (path, callback (status, header, data, encoding)) */) {
	return http.createServer(function(req, res) {
		var data = "";
		req.setEncoding("utf8");
		req.addListener("data", function(chunk) {
			data += chunk;
		});
		req.addListener("end", function() {
			var token = {};
			var path = url.parse(req.url).pathname;
			var remoteAddress = req.socket.remoteAddress || null;
			if("127.0.0.1" == remoteAddress) remoteAddress = null;
			var query = bt.union((data ? JSON.parse(data) : {}), {remoteAddress: remoteAddress});
			var result;
			try {
				result = dispatcher(token, bt.components(path), query);
			} catch(err) {
				res.writeHead(500, {});
				res.end();
				sys.log(err);
				return;
			}
			if(result === token) return unknownHandler(path, function(status, header, data, encoding) {
				res.writeHead(status, header);
				res.end(data, encoding);
			});
			if(typeof result === "function") return result(req, res, path);
			return wrapper.writeJSON(res, result);
		});
	});
};
wrapper.createFileHandler = function(basePath) {
	return bt.memoize(function(path, callback) {
		if(/\.\./.test(path)) return callback(403, {});
		if(/\/$/.test(path)) path += "index.html";
		path = basePath + path;
		MIMEForPath(path, function(type) {
			var readFileCompressed = function(path, callback) {
				fs.readFile(path+".gz", function(err, data) {
					if(!err) return callback(err, data, "gzip");
					fs.readFile(path, function(err, data) {
						callback(err, data, "identity");
					});
				});
			};
			if("text/" === type.slice(0, 5)) type += "; charset=UTF-8";
			readFileCompressed(path, function(err, data, compression) {
				if(err) return callback(2 == err.errno ? 404 : 500, {})
				return callback(200, {
					"Content-Type": type,
					"Content-Length": data.length,
					"Content-Encoding": compression,
				}, data);
			});
		});
	});
};
wrapper.writeJSON = function(res, value) {
//	sys.debug(value);
	var body = JSON.stringify(value);
	if(!body) body = "";
	res.writeHead(200, {
		"Content-Type": "text/json; charset=UTF-8",
		"Content-Length": body.length,
	});
	res.end(body, "utf8");
};
