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
var qs = require("querystring");
var https = require("https");
var http = require("http");

var bt = require("../../shared/bt");

var paypal = exports;
paypal.verify = function(real, body, callback/* (err, attrs) */) {
	var outgoing = new Buffer("cmd=_notify-validate&"+body, "utf8");
	var options = {
		"port": 443,
		"host": real ? "www.paypal.com" : "www.sandbox.paypal.com",
		"path": "/cgi-bin/webscr",
		"method": "POST",
		"headers": {
			"content-length": outgoing.length,
		},
	};
	var req = https.request(options, function(res) {
		var verified = "";
		if(200 != res.statusCode) return callback({"httpStatusCode": res.statusCode}, null);
		res.setEncoding("utf8");
		res.addListener("data", function(chunk) {
			verified += chunk;
		});
		res.addListener("end", function() {
			if("VERIFIED" !== verified) return callback({"verified": false}, null);
			callback(null, qs.parse(body));
		});
	});
	req.end(outgoing);
};
paypal.verifyAttributes = function(attributes, required) {
	for(var prop in required) if(bt.hasOwnProperty(required, prop)) {
		if(!bt.hasOwnProperty(attributes, prop)) return false;
		if(required[prop] !== attributes[prop]) return false;
	}
	return true;
};
paypal.pennies = function(string) {
	var match = /(\d+)\.(\d{2})/.exec(string);
	if(!match) return 0;
	return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
};

paypal.test = function() {
	var server = http.createServer(function(req, res) {
		var body = "";
		req.setEncoding("utf8");
		req.addListener("data", function(chunk) {
			body += chunk;
		});
		req.addListener("end", function() {
			res.writeHead(200, "OK", {"Content-Length": 0});
			res.end();
			paypal.verify(false, body, function(err, attrs) {
				console.log("Verified IPN", err, attrs);
			});
		});
	});
	server.listen(80);
};
