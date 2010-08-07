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

var assert = require("assert");
var sys = require("sys");

var bt = require("../../shared/bt");

var mysql = require("../external/mysql");

wrapper.connect = function(conf, callback, errback) {
	var connection = new mysql.Connection(conf);
	connection.defaultErrback = function(error) {
		sys.puts(JSON.stringify(error, null, 1));
	};
	connection.connect(callback, errback);
	return connection;
};
wrapper.format = function(format, arg1, arg2, etc) {
	var args = Array.prototype.slice.call(arguments, 1);
	return format.replace(/[$#]/g, function(type) { // $: Quoted value; #: Unquoted value
		var arg = args.shift();
		assert.ok(undefined !== arg, "Format arguments must not be undefined");
		if(null === arg) return "NULL";
		if(Number === arg.constructor && isNaN(arg)) return 0;
		if(String === arg.constructor) {
			if("#" === type) return arg;
			return "'"+mysql.quote(arg)+"'";
		}
		return arg.toString();
	});
};
wrapper.rows = function(result) {
	return result.records.map(function(values) {
		return bt.pair(result.fields.map(function(field) {
			return field.name;
		}), values);
	});
};
