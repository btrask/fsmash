#!/usr/bin/env node

var mysql = require("../server/utilities/mysql-wrapper");
var paypal = require("../server/utilities/paypal");
var config = require("../server/config/");
var db = mysql.connect(config.database);

// TODO: Don't copy paste. Although this version has more debugging.
function donation(data) {
	paypal.verify(true, data, function(err, query) {
		if(err) throw err;
		if(!query) throw new Error("No query");
		if(!paypal.verifyAttributes(query, config.PayPal.verify)) throw new Error("Not verified");
		var custom = JSON.parse(query["custom"]);
		var sourceUserID = parseInt(custom.sourceUserID, 10);
		var targetUserID = parseInt(custom.targetUserID, 10);
		if(!sourceUserID) throw new Error("No source user ID");
		if(!targetUserID) throw new Error("No target user ID");
		var pennies = paypal.pennies(query["mc_gross"] || query["mc_gross_1"]);
		if(config.PayPal.payment.pennies.min > pennies) throw new Error("Donation too small");
		if(config.PayPal.payment.pennies.max < pennies) throw new Error("Donation too large");
		if("Completed" != query["payment_status"]) throw new Error("Donation not completed");
		// We shouldn't need to check the txn_type as long as the other conditions are met.
		db.query(
			"SELECT UNIX_TIMESTAMP(expireTime) * 1000 expireTime"+
			" FROM donations WHERE targetUserID = $ AND expireTime > NOW()"+
			" ORDER BY expireTime DESC LIMIT 1",
			[targetUserID],
			function(err, donationsResult) {
				if(err) throw err;
				var startTime = donationsResult.length ? mysql.rows(donationsResult)[0].expireTime : new Date().getTime();
				var additional = Math.ceil((((pennies / 4) * 3) * (1000 * 60 * 60 * 24 * (365.242199 / 12))) / 100);
				db.query(
					"INSERT IGNORE INTO donations (sourceUserID, targetUserID, payerID, transactionID, pennies, startTime, expireTime)"+
					" VALUES ($, $, $, $, $, FROM_UNIXTIME($ / 1000), DATE_SUB(FROM_UNIXTIME($ / 1000), INTERVAL ($ / -1000) SECOND))",
					[sourceUserID, targetUserID, query["payer_id"], query["txn_id"], pennies, startTime, startTime, additional],
					function(err, donationResult) {
						if(err && "ER_DUP_ENTRY" === err.code) throw new Error("Duplicate");
						if(err) throw err;
						console.log("Done?");
						db.end();
					}
				);
			}
		);
	});
}

donation(process.argv[2]);

