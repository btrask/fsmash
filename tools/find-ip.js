#!/usr/bin/env node
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
if(process.argv.length < 3) {
	console.error("Usage: find-ip <ip address>");
	process.exit();
}

var mysql = require("mysql");

var config = require("../server/config/");
var db = mysql.createConnection(config.database);

var ipAddress = process.argv[2];
db.query(
	'SELECT s.userID, u.userName, u.registerTime, count(s.userID) logins'+
	' FROM sessions s'+
	' LEFT JOIN users u ON (s.userID = u.userID)'+
	' WHERE ipAddress = inet_aton(?)'+
	' ORDER BY logins DESC LIMIT 10',
	["%"+ipAddress+"%"],
	function(err, results) {
		if(err) console.error(err);
		console.log(results);
		db.end();
	}
);
