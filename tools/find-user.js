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
	console.error("Usage: pass [username]");
	process.exit();
}

var mysql = require("mysql");

var config = require("../server/config/");
var db = mysql.createConnection(config.database);

var username = process.argv[2];
db.query(
	'SELECT `userID`, `userName` FROM `users`'+
	' WHERE `userName` LIKE ?'+
	' ORDER BY `userID` DESC LIMIT 10',
	["%"+username+"%"],
	function(err, results) {
		if(err) console.error(err);
		console.log(results);
		db.end();
	}
);
