#!/usr/bin/env node

var mysql = require("../server/utilities/mysql-wrapper");
var donation = require("../server/utilities/donation");
var config = require("../server/config/");
var db = mysql.connect(config.database);

donation.process(db, process.argv[2], function(err, obj) {
	db.end();
	console.error(err, obj);
});

