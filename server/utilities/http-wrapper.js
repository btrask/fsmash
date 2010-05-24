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

var MIMEByExt = JSON.parse(fs.readFileSync(__dirname+"/mime.json"));

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
			var query = bt.union((data ? JSON.parse(data) : {}), {remoteAddress: req.remoteAddress || null});
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
wrapper.MIMEForPath = function(str, callback) {
	var ext = path.extname(str).slice(1), MIME;
	if(MIMEByExt.hasOwnProperty(ext)) MIME = MIMEByExt[ext];
	callback(MIME || "application/octet-stream");
};
