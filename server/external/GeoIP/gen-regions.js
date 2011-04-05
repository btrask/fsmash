#!/usr/bin/env node
/* Copyright (C) 2011 Ben Trask

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
var fs = require("fs");
var path = require("path");
var util = require("util");

if(process.argv.length < 3) {
	console.log("Usage: gen-regions.js csv-file");
	console.log("This generates a `region-names.json` file in the GeoIP directory.");
	console.log("`csv-file` can be built from:");
	console.log("\thttp://www.maxmind.com/app/iso3166_2");
	console.log("\thttp://www.maxmind.com/app/fips10_4");
	process.exit(0);
}

var nameByRegionByCountry = {};
fs.readFileSync(path.resolve(process.cwd(), process.argv[2]), "utf8").split("\n").map(function(line) {
	var match = /([\w\d]{2}),([\w\d]{2}),"([^\n]*)"/.exec(line);
	if(!match) return;
	var country = match[1];
	var region = match[2];
	var name = match[3];
	if(!nameByRegionByCountry.hasOwnProperty(country)) nameByRegionByCountry[country] = {};
	nameByRegionByCountry[country][region] = name;
});
fs.writeFileSync(path.join(__dirname, "region-names.json"), JSON.stringify(nameByRegionByCountry, null, "\t") + "\n", "utf8");
