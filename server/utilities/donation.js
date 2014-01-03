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
var donation = exports;

var mysql = require("./mysql-wrapper");
var config = require("../config/");
var paypal = require("./paypal");

donation.process = function(db, data, callback/* (err) */) {
	paypal.verify(true, data, function(err, query) {
		if(err) return callback(err, null);
		if(!query) return callback(new Error("No query"), null);
		if(!paypal.verifyAttributes(query, config.PayPal.verify)) return callback(new Error("Not verified"), null);
		var custom = JSON.parse(query["custom"]);
		var sourceUserID = parseInt(custom.sourceUserID, 10);
		var targetUserID = parseInt(custom.targetUserID, 10);
		if(!sourceUserID) return callback(new Error("No source user ID"), null);
		if(!targetUserID) return callback(new Error("No target user ID"), null);
		var pennies = paypal.pennies(query["mc_gross"] || query["mc_gross_1"]);
		if(config.PayPal.payment.pennies.min > pennies) return callback(new Error("Donation too small"), null);
		if(config.PayPal.payment.pennies.max < pennies) return callback(new Error("Donation too large"), null);
		if("Completed" != query["payment_status"]) return callback(new Error("Donation not completed"), null);
		// We shouldn't need to check the txn_type as long as the other conditions are met.
		db.query(
			"SELECT UNIX_TIMESTAMP(expireTime) * 1000 expireTime"+
			" FROM donations WHERE targetUserID = $ AND expireTime > NOW()"+
			" ORDER BY expireTime DESC LIMIT 1",
			[targetUserID],
			function(err, donationsResult) {
				if(err) return callback(err, null);
				var startTime = donationsResult.length ? mysql.rows(donationsResult)[0].expireTime : new Date().getTime();
				var additional = Math.ceil((((pennies / 4) * 3) * (1000 * 60 * 60 * 24 * (365.242199 / 12))) / 100);
				db.query(
					"INSERT INTO donations (sourceUserID, targetUserID, payerID, transactionID, pennies, startTime, expireTime)"+
					" VALUES ($, $, $, $, $, FROM_UNIXTIME($ / 1000), DATE_SUB(FROM_UNIXTIME($ / 1000), INTERVAL ($ / -1000) SECOND))",
					[sourceUserID, targetUserID, query["payer_id"], query["txn_id"], pennies, startTime, startTime, additional],
					function(err, donationResult) {
						if(err && "ER_DUP_ENTRY" === err.code) return callback(new Error("Duplicate"), null);
						if(err) return callback(err, null);
						return callback(null, {
							startTime: startTime,
							additional: additional,
							expireTime: startTime+additional,
							sourceUserID: sourceUserID,
							targetUserID: targetUserID,
							pennies: pennies,
						});
					}
				);
			}
		);
	});
};

