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
	console.error("Usage: user-rename <old name> <new name>");
	process.exit();
}

var mysql = require("mysql");

var config = require("../server/config/");
var db = mysql.createConnection(config.database);

var a = process.argv[2];
var b = process.argv[3];
// TODO: We're using transactions but we're still using MyISAM. We should switch to InnoDB at some point...
db.query('START TRANSACTION');
db.query(
	'DELETE FROM users WHERE userName = ? AND passHash IS NULL AND passHash2 IS NULL',
	[b],
	function(err, results) {
		if(err) {
			console.error(err);
			db.query('ROLLBACK');
			db.end();
			return;
		}
		db.query(
			'UPDATE users SET userName = ? WHERE userName = ?',
			[b, a],
			function(err, results) {
				if(err) {
					console.error(err);
					db.query('ROLLBACK');
					db.end();
					return;
				}
				db.query(
					'INSERT INTO users (userName) VALUES (?)',
					[a],
					function(err, results) {
						if(err) {
							console.error(err);
							db.query('ROLLBACK');
							db.end();
							return;
						}
						db.query('COMMIT');
						db.end();
					}
				);
			}
		);
	}
);
