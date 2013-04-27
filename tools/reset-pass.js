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
if(process.argv.length < 4) {
	console.error("Usage: reset-pass <username> <password>");
	process.exit();
}

var bcrypt = require("bcrypt");
var mysql = require("mysql");

var config = require("../server/config/");
var db = mysql.createConnection(config.database);

var username = process.argv[2];
var password = process.argv[3]; // TODO: It'd be better to read the password from stdin.
var passhash = bcrypt.hashSync(password, 8);
db.query(
	'UPDATE `users` SET `passhash2` = ?, `passhash` = NULL'+
	' WHERE `userName` = ?',
	[passhash, username],
	function(err, results) {
		if(err) console.error(err);
		console.log("Changed rows: "+results.affectedRows);
		db.end();
	}
);
