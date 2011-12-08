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
var assert = require("assert");
var fs = require("fs");
var https = require("https");
var querystring = require("querystring");
var url = require("url");
var util = require("util");

var GeoIP = require("./external/GeoIP/");
var limiter = require("./external/limiter");

var crypt = require("./utilities/crypt-wrapper");
var crypto = require("./utilities/crypto-wrapper");
var http = require("./utilities/http-wrapper");
var mysql = require("./utilities/mysql-wrapper");

var bt = require("../shared/bt");
var brawl = require("../shared/brawl");
var config = require("./config/");

var Group = require("./classes/Group");
var Session = require("./classes/Session");
var Channel = require("./classes/Channel");
var Game = require("./classes/Game");

var db = mysql.connect(config.database);
var geoip = new GeoIP(config.GeoIP.path);
var startTime = new Date().getTime();
var signinLimitForIP = {};

process.title = config.process.title;
util.log("Starting " + process.title);

(function signalHandling() {
	if(!config.process.faultTolerant) return;
	var signals = [
		"SIGABRT",
		"SIGALRM",
		"SIGFPE",
		"SIGHUP",
		"SIGILL",
		"SIGINT",
		"SIGKILL",
		"SIGQUIT",
		"SIGSEGV",
		"SIGTERM",
		"SIGUSR1",
		"SIGUSR2",
		"SIGCHLD",
		"SIGCONT",
		"SIGSTOP",
		"SIGTSTP",
		"SIGTTIN",
		"SIGTTOU",
		"SIGBUS",
		"SIGPOLL",
		"SIGSYS",
		"SIGTRAP",
		// Ignore SIGPROF, it is used by Crankshaft in V8.
	];
	for(var i = 0; i < signals.length; ++i) process.addListener(signals[i], bt.curry(util.log, signals[i]));
	process.addListener("SIGPIPE", function() {
		// Ignore silently.
	});
	process.addListener("uncaughtException", function(err) {
		util.log(err.stack);
	});
})();

var remoteAddressOfRequest = function(req) {
	var remoteAddress = (config.server.remoteAddressField ? req.headers[config.server.remoteAddressField] : req.socket.remoteAddress) || null;
	return "127.0.0.1" === remoteAddress ? null : remoteAddress;
};
var fileHandler = (function() {
	var handler = http.createFileHandler(__dirname+"/../public");
	var wrapper = function(req, res, filename) {
		db.query("INSERT INTO httpRequests (ipAddress, filename, header, referer, userAgent) VALUES (INET_ATON($), $, $, $, $)", [remoteAddressOfRequest(req), filename, JSON.stringify(req.headers), req.headers.referer || null, req.headers["user-agent"] || null]);
		return handler(req, res, filename);
	};
	wrapper.rescan = function() {
		handler.rescan();
	};
	return wrapper;
})();
var configureSessions = (function configureSessions() {
	db.query(
		"SELECT soundsetID, label, path, challenge, `join`, `leave`, message"+
		" FROM soundsets WHERE 1 ORDER BY sortOrder ASC",
		function(err, soundsetsResult) {
			if(err) throw err;
			Session.config.soundsets = mysql.rows(soundsetsResult);
		}
	);
	db.query(
		"SELECT pc.channelID, c.topic, c.allowsGameChannels, c.historyJSON, pc.descriptionHTML"+
		" FROM publicChannels pc"+
		" LEFT JOIN channels c ON (pc.channelID = c.channelID)"+
		" WHERE 1 ORDER BY pc.sortOrder ASC",
		function(err, channelsResult) {
			if(err) throw err;
			var channel;
			var channelRows = mysql.rows(channelsResult).map(function(channelRow) {
				channelRow.allowsGameChannels = Boolean(channelRow.allowsGameChannels);
				return channelRow;
			});
			Session.config.publicChannels = channelRows;
			Channel.public.byID = {};
			channelRows.map(function(channelRow) {
				if(Channel.byID.hasOwnProperty(channelRow.channelID)) channel = Channel.byID[channelRow.channelID];
				else channel = new Channel(null, channelRow.channelID);
				channel.info.topic = channelRow.topic;
				channel.info.allowsGameChannels = channelRow.allowsGameChannels;
				channel.history = JSON.parse(channelRow.historyJSON || "[]");
				Channel.public.byID[channelRow.channelID] = channel;
			});
		}
	);
	db.query(
		"SELECT matchTypeID, label, hasTeams, playerCount"+
		" FROM matchTypes WHERE 1 ORDER BY sortOrder ASC",
		function(err, matchTypesResult) {
			if(err) throw err;
			Session.config.matchTypes = mysql.rows(matchTypesResult);
			bt.map(Session.config.matchTypes, function(matchType) {
				matchType.hasTeams = Boolean(parseInt(matchType.hasTeams, 10));
			});
		}
	);
	db.query(
		"SELECT ruleID, label"+
		" FROM rules WHERE 1 ORDER BY sortOrder ASC",
		function(err, rulesResult) {
			if(err) throw err;
			Session.config.rules = mysql.rows(rulesResult);
			Group.users.sendEvent("/user/config/", Session.config);
		}
	);
	return configureSessions;
})();
var updateRankings = function() {
	db.query("LOCK TABLES rankings WRITE, ratings r1 READ, ratings r2 READ, users u READ");
	db.query("DELETE FROM rankings WHERE 1");
	db.query("ALTER TABLE rankings AUTO_INCREMENT = 0");
	db.query(
		"INSERT INTO rankings (userID, directPoints, indirectPoints, totalPoints)"+
		" SELECT u.userID, COUNT(DISTINCT r1.fromUserID), COUNT(r2.fromUserID), COUNT(DISTINCT r1.fromUserID) + COUNT(r2.fromUserID)"+
		" FROM ratings r1"+
		" LEFT JOIN ratings r2 ON (r1.fromUserID = r2.toUserID AND"+
			" r2.ratingType = -1 AND r2.isContradicted = 0 AND r2.ratingTime < DATE_SUB(NOW(), INTERVAL 1 DAY) AND r2.ratingTime > DATE_SUB(NOW(), INTERVAL 6 MONTH))"+
		" LEFT JOIN users u ON (r1.toUserID = u.userID)"+
		" WHERE u.userName IS NOT NULL AND"+
			" r1.ratingType = -1 AND r1.isContradicted = 0 AND r1.ratingTime < DATE_SUB(NOW(), INTERVAL 1 DAY) AND r1.ratingTime > DATE_SUB(NOW(), INTERVAL 6 MONTH)"+
		" GROUP BY r1.toUserID"
	);
	db.query("UNLOCK TABLES");
};
setInterval(updateRankings, config.rankings.update.interval);

var root = bt.dispatch();
root.api = bt.dispatch(null, function(func, req, data) {
	var query = bt.union((data ? JSON.parse(data) : {}), {remoteAddress: remoteAddressOfRequest(req)});
	return func(query);
});

root.api.session = bt.dispatch(function(query) {
	if(query.sessionID || query.sessionKey) return {error: "Session already exists"};
	return new Session(query.remoteAddress).info;
}, function(func, query) {
	var id = query.sessionID;
	if(undefined === id) return {error: "No session ID specified", needsNewSession: true};
	if(!Session.byID.hasOwnProperty(id)) return {error: "Invalid session ID", needsNewSession: true};
	var session = Session.byID[id];
	if(session.info.sessionKey !== query.sessionKey) return {error: "Invalid session key", needsNewSession: true};
	if(query.remoteAddress !== session.remoteAddress) return {error: "Wrong IP address", needsNewSession: true};
	return func(query, session);
});
root.api.session.terminate = bt.dispatch(function(query, session) {
	session.terminate();
	return true;
});
root.api.session.watch = bt.dispatch(function(query, session) {
	return function(req, res) {
		session.setEventCallback(bt.curry(http.writeJSON, req, res));
	};
});


root.api.session.user = bt.dispatch(function(query, session) {
	if(undefined === query.userName) return {error: "No user name specified"};
	if(undefined === query.password && undefined === query.userToken) return {error: "No password specified"};
	return session.promise(function(ticket) {
		var accountError = function(reason) {
			session.sendEvent("/user/", {accountError: reason}, ticket);
		};

		var signup = function() {
			if(!config.signup.allowed) return accountError("Account creation is temporarily disabled");
			if(!query.userName.length) return accountError("Enter a name & pass, then click “Sign Up”");
			if(/^\s|\s\s+|\s$/.test(query.userName)) return accountError("Invalid whitespace in user name");
			if(query.userName.length < config.signup.username.length.min) return accountError("User name must be at least " + config.signup.username.length.min + " characters");
			if(query.userName.length > config.signup.username.length.max) return accountError("User name must be at most " + config.signup.username.length.max + " characters");
			if(query.password.length < config.signup.password.length.min) return accountError("Password must be at least " + config.signup.password.length.min + " characters");
			if(query.password.length > config.signup.password.length.max) return accountError("Password must be at most " + config.signup.password.length.max + " characters");
			db.query(
				"SELECT * FROM sessions WHERE ipAddress = INET_ATON($) LIMIT 1",
				[query.remoteAddress],
				function(err, sessionsResult) {
					if(sessionsResult.length) return accountError("You already have an account");
					db.query(
						"INSERT INTO users (userName, passHash2) VALUES ($, $)",
						[query.userName, crypt.hash(query.password)],
						function(err, userResult) {
							if(err && 1062 === err.number) return accountError("Username already in use");
							var userID = userResult.insertId;
							db.query("INSERT IGNORE INTO settings (userID) VALUES ($)", [userID]);
							loadUser(userID, query.userName);
						}
					);
				}
			);
		};
		var signin = function() {
			if(query.remoteAddress) {
				if(!signinLimitForIP.hasOwnProperty(query.remoteAddress)) {
					signinLimitForIP[query.remoteAddress] = limiter.throttle(config.signin.rate, true, function onClear() {
						delete signinLimitForIP[query.remoteAddress];
					});
				}
				if(signinLimitForIP[query.remoteAddress]()) return accountError("Too many signin attempts");
			}
			if(query.userToken) {
				db.query(
					"SELECT u.userID, u.userName"+
					" FROM users u"+
					" LEFT JOIN tokens t ON (u.userID = t.userID)"+
					" WHERE u.userName = $ AND t.token = $ LIMIT 1",
					[query.userName, query.userToken],
					function(err, userResult) {
						if(!userResult.length) return accountError("Invalid token");
						var userRow = mysql.rows(userResult)[0];
						loadUser(userRow.userID, userRow.userName);
					}
				);
			} else {
				var legacyPassHash = crypto.SHA1(query.password);
				db.query(
					"SELECT userID, userName, passHash2 FROM users"+
					" WHERE userName = $ AND (passHash2 IS NOT NULL OR passHash = $) LIMIT 1",
					[query.userName, legacyPassHash],
					function(err, userResult) {
						if(!userResult.length) return accountError("Incorrect username or password");
						var userRow = mysql.rows(userResult)[0];
						if(userRow.passHash2) {
							if(!crypt.check(query.password, userRow.passHash2)) return accountError("Incorrect username or password");
						} else {
							db.query(
								"UPDATE users SET passHash = NULL, passHash2 = $"+
								" WHERE userID = $ AND passHash = $ LIMIT 1",
								[crypt.hash(query.password), userRow.userID, legacyPassHash]
							);
						}
						loadUser(userRow.userID, userRow.userName);
					}
				);
			}
		};
		var loadUser = function(userID, userName) {
			var createUser = function() {
				session.signin(userID);
				session.user.info.userName = userName;
				loadUserInfo(session.user);
			};
			var recordBan = function(dependentSession) {
				db.query(
					"INSERT IGNORE INTO bannedSessions"+
					" (dependentSessionID, sessionID) SELECT $, sessionID"+
					" FROM sessions"+
					" WHERE userID = $ OR ipAddress = INET_ATON($)",
					[dependentSession || null, userID, query.remoteAddress]
				);
				accountError("You are banned");
			};
			db.query("INSERT INTO sessions (userID, ipAddress) VALUES ($, INET_ATON($))", [userID, query.remoteAddress]);
			db.query(
				"SELECT * FROM whitelist WHERE userID = $ LIMIT 1",
				[userID],
				function(err, whitelistResult) {
					if(whitelistResult.length) return createUser(userID, userName);
					db.query(
						"SELECT bs.sessionID FROM bannedSessions bs"+
						" LEFT JOIN sessions s ON (bs.sessionID = s.sessionID)"+
						" WHERE s.userID = $ OR s.ipAddress = INET_ATON($) LIMIT 1",
						[userID, query.remoteAddress],
						function(err, bannedSessionResult) {
							if(bannedSessionResult.length) return recordBan(mysql.rows(bannedSessionResult)[0].sessionID);
							db.query(
								"SELECT bannedIPID"+
								" FROM bannedIPs"+
								" WHERE minIPAddress <= INET_ATON($) AND maxIPAddress >= INET_ATON($)",
								[query.remoteAddress, query.remoteAddress],
								function(err, bannedIPResult) {
									if(bannedIPResult.length) return recordBan();
									createUser(userID, userName);
								}
							);
						}
					);
				}
			);
		};
		var loadUserInfo = function(user) {
			db.query(
				"SELECT brawlName, friendCode, bio, color FROM profiles"+
				" WHERE userID = $ LIMIT 1",
				[user.info.userID],
				function(err, profileResult) {
					if(profileResult.length) bt.mixin(user.info, mysql.rows(profileResult)[0]);
				}
			);
			db.query(
				"SELECT ignoredUserID FROM ignores WHERE userID = $",
				[user.info.userID],
				function(err, ignoresResult) {
					bt.map(mysql.rows(ignoresResult), function(row) {
						user.ignoringByUserID[row.ignoredUserID] = true;
					});
				}
			);
			db.query(
				"SELECT UNIX_TIMESTAMP(expireTime) * 1000 expireTime"+
				" FROM donations WHERE userID = $ AND expireTime > NOW()"+
				" ORDER BY expireTime DESC LIMIT 1",
				[user.info.userID],
				function(err, donationResult) {
					if(donationResult.length) {
						user.info.subscriber = true;
						user.subscriptionExpireTime = mysql.rows(donationResult)[0].expireTime;
					} else {
						delete user.info.color;
					}
				}
			);
			db.query(
				"SELECT totalPoints FROM rankings WHERE userID = $ LIMIT 1",
				[user.info.userID],
				function(err, pointsResult) {
					if(!pointsResult.length) return loadUserLocation(user);
					db.query(
						"SELECT COUNT(*) + 1 rank FROM rankings WHERE totalPoints > $",
						[mysql.rows(pointsResult)[0].totalPoints],
						function(err, rankResult) {
							user.info.rank = mysql.rows(rankResult)[0].rank;
							loadUserLocation(user);
						}
					);
				}
			);
		};
		var loadUserLocation = function(user) {
			var callback = function(err, location) {
				user.info.location = bt.map([location.region, location.country], function(part) {
					return part || undefined;
				}).join(", ");
				loadUserChannels(user);
			};
			if(config.GeoIP.customDefinitions.hasOwnProperty(query.remoteAddress)) callback(null, config.GeoIP.customDefinitions[query.remoteAddress]);
			else geoip.lookup(GeoIP.parseIP(query.remoteAddress), callback);
		};
		var loadUserChannels = function(user) {
			db.query(
				"SELECT cmem.channelID, c.parentID, c.topic, c.allowsGameChannels, c.historyJSON, g.matchTypeID, g.ruleID, cmod.channelModeratorID"+
				" FROM channelMembers cmem"+
				" LEFT JOIN channels c ON (cmem.channelID = c.channelID)"+
				" LEFT JOIN games g ON (cmem.channelID = g.channelID)"+
				" LEFT JOIN channelModerators cmod ON (cmem.channelID = cmod.channelID AND cmem.userID = cmod.moderatorUserID)"+
				" WHERE cmem.userID = $ ORDER BY cmem.channelID ASC",
				[user.info.userID],
				function(err, channelResult) {
					sendUser(user);
					mysql.rows(channelResult).map(function(channelRow) {
						var channel, game;
						if(Channel.byID.hasOwnProperty(channelRow.channelID)) channel = Channel.byID[channelRow.channelID];
						else {
							channel = new Channel(channelRow.parentID, channelRow.channelID);
							channel.info.allowsGameChannels = Boolean(channelRow.allowsGameChannels);
							channel.history = JSON.parse(channelRow.historyJSON || "[]");
							if(channelRow.topic) {
								channel.info.topic = channelRow.topic;
							} else {
								game = new Game(channel);
								game.info.matchTypeID = channelRow.matchTypeID || 0;
								game.info.ruleID = channelRow.ruleID || 0;
							}
						}
						channel.addUser(user);
						channel.group.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: user.info.userID}, undefined, [user]);
						if(channelRow.channelModeratorID) {
							user.moderatorChannelByID[channel.info.channelID] = channel;
							user.sendEvent("/user/channel/moderator/", {channelID: channel.info.channelID});
						}
					});
				}
			);
		};
		var sendUser = function(user) {
			session.sendEvent("/user/", user.info, ticket);
			user.sendEvent("/user/config/", Session.config);
			Group.users.sendEvent("/user/person/", user.info);
			bt.map(Session.byUserID, function(otherSession, otherUserID) {
				if(parseInt(otherUserID, 10) === user.info.userID) return;
				session.sendEvent("/user/person/", otherSession.user.info);
			});
			user.sendEvent("/user/ignore/", {ignoringByUserID: user.ignoringByUserID});
			user.sendEvent("/user/subscription/", {expireTime: user.subscriptionExpireTime});
			db.query(
				"SELECT styleID, soundsetID FROM settings WHERE userID = $ LIMIT 1",
				[user.info.userID],
				function(err, settingsResult) {
					if(!settingsResult.length) return;
					user.sendEvent("/user/settings/", mysql.rows(settingsResult)[0]);
				}
			);
			db.query(
				"SELECT administratorID FROM administrators WHERE administratorUserID = $ LIMIT 1",
				[user.info.userID],
				function(err, administratorResult) {
					if(!administratorResult.length) return;
					user.administrator = true;
					Group.administrators.objects.push(user);
					user.sendEvent("/user/administrator/", {signupAllowed: config.signup.allowed});
					db.query(
						"SELECT u.userName, c.topic, UNIX_TIMESTAMP(r.reportTime) * 1000 time"+
						" FROM reports r"+
						" LEFT JOIN users u ON (r.userID = u.userID)"+
						" LEFT JOIN channels c ON (r.channelID = c.channelID)"+
						" WHERE r.reportTime > DATE_SUB(NOW(), INTERVAL 3 DAY) AND r.isResolved = 0"+
						" ORDER BY r.reportTime DESC",
						function(err, reportResults) {
							user.sendEvent("/user/administrator/reports/", mysql.rows(reportResults));
						}
					);
					db.query(
						"SELECT u.userName modUserName, c.topic, cm.censorText, cm.replacementText, UNIX_TIMESTAMP(cm.censorTime) * 1000 time"+
						" FROM censoredMessages cm"+
						" LEFT JOIN users u ON (cm.modUserID = u.userID)"+
						" LEFT JOIN channels c ON (cm.channelID = c.channelID)"+
						" WHERE cm.censorTime > DATE_SUB(NOW(), INTERVAL 3 DAY)"+
						" ORDER BY cm.censorTime DESC",
						function(err, censorResults) {
							user.sendEvent("/user/administrator/censored/", mysql.rows(censorResults));
						}
					);
				}
			);
		};
		if(query.signup) signup();
		else signin();
	});
}, function(func, query, session) {
	if(!session.user) return {error: "Session not signed in"};
	return func(query, session, session.user);
});
root.api.session.user.password = bt.dispatch(function(query, session, user) {
	if(undefined === query.oldPassword) return {error: "No old password specified"};
	if(undefined === query.newPassword) return {error: "No new password specified"};
	if(query.newPassword.length < config.signup.password.length.min) return {passwordError: "Password must be at least " + config.signup.password.length.min + " characters"};
	if(query.newPassword.length > config.signup.password.length.max) return {passwordError: "Password must be at most " + config.signup.password.length.max + " characters"};
	return session.promise(function(ticket) {
		var legacyPassHash = crypto.SHA1(query.oldPassword);
		db.query(
			"SELECT * FROM users"+
			" WHERE userID = $ AND (passHash2 IS NOT NULL OR passHash = $)"+
			" LIMIT 1",
			[user.info.userID, legacyPassHash],
			function(err, userResult) {
				var incorrectPassword = function() {
					user.sendEvent("/user/password/", {passwordError: "Incorrect password"}, ticket);
				};
				if(!userResult.length) return incorrectPassword();
				var userRow = mysql.rows(userResult)[0];
				if(null !== userRow.passHash2 && !crypt.check(query.oldPassword, userRow.passHash2)) return incorrectPassword();
				db.query(
					"UPDATE users"+
					" SET passHash = NULL, passHash2 = $"+
					" WHERE userID = $ LIMIT 1",
					[crypt.hash(query.newPassword), user.info.userID]
				);
				user.sendEvent("/user/password/", {}, ticket);
			}
		);
	});
});
root.api.session.user.remember = bt.dispatch(function(query, session, user) {
	var token = crypt.randomString(50);
	db.query("REPLACE tokens (userID, token) VALUES ($, $)", [user.info.userID, token]);
	return {token: token};
});
root.api.session.user.settings = bt.dispatch(function(query, session, user) {
	var settings = [];
	if(undefined !== query.styleID) {
		settings.push(db.format("styleID = $", parseInt(query.styleID, 10)));
	}
	if(undefined !== query.soundsetID) {
		settings.push(db.format("soundsetID = $", parseInt(query.soundsetID, 10)));
	}
	if(settings.length) {
		db.query("INSERT IGNORE INTO settings (userID) VALUES ($)", [user.info.userID]);
		db.query("UPDATE settings SET # WHERE userID = $ LIMIT 1", [settings.join(", "), user.info.userID]);
	}
	return true;
});
root.api.session.user.profile = bt.dispatch(function(query, session, user) {
	var fields = [];
	if(undefined !== query.brawlName) {
		user.info.brawlName = brawl.brawlName(query.brawlName.toString());
		fields.push(db.format("brawlName = $", user.info.brawlName));
	}
	if(undefined !== query.friendCode) {
		user.info.friendCode = brawl.friendCode(query.friendCode.toString(), "");
		fields.push(db.format("friendCode = $", user.info.friendCode));
	}
	if(undefined !== query.bio) {
		user.info.bio = query.bio.toString().slice(0, config.User.bio.length.max);
		fields.push(db.format("bio = $", user.info.bio));
	}
	if(!fields.length) return false;
	return session.promise(function(ticket) {
		Group.users.sendEvent("/user/person/", user.info, ticket);
		db.query("INSERT IGNORE INTO profiles (userID) VALUES ($)", [user.info.userID]);
		db.query("UPDATE profiles SET # WHERE userID = $ LIMIT 1", [fields.join(", "), user.info.userID]);
	});
});
root.api.session.user.idle = bt.dispatch(function(query, session, user) {
	if(Boolean(query.idle) === Boolean(user.info.idle)) return true;
	return session.promise(function(ticket) {
		user.info.idle = Boolean(query.idle);
		Group.users.sendEvent("/user/person/", user.info, ticket);
	});
});

root.api.session.user.subscription = bt.dispatch(null, function(func, query, session, user) {
	if(!user.info.subscriber) return {error: "Subscriber membership required"};
	return func(query, session, user);
});
root.api.session.user.subscription.color = bt.dispatch(function(query, session, user) {
	var match = /[0-9a-fA-f]{6}/.exec(String(query.color));
	var color = match ? match[0] : null;
	return session.promise(function(ticket) {
		user.info.color = color;
		Group.users.sendEvent("/user/person/", user.info, ticket);
		db.query(
			"UPDATE profiles SET color = $ WHERE userID = $ LIMIT 1",
			[color, user.info.userID]
		);
	});
});

root.api.session.user.administrator = bt.dispatch(null, function(func, query, session, user) {
	if(!user.administrator) return {error: "Administrator permissions required"};
	return func(query, session, user);
});
root.api.session.user.administrator.signups = bt.dispatch(function(query, session, user) {
	config.signup.allowed = Boolean(query.signupAllowed);
	return {signupAllowed: config.signup.allowed};
});
root.api.session.user.administrator.statistics = bt.dispatch(function(query, session, user) {
	return {
		memory: process.memoryUsage(),
		platform: process.platform,
		version: process.version,
		sessions: Group.sessions.objects.length,
		users: Group.users.objects.length,
		channels: Channel.count,
		uptime: (new Date().getTime() - startTime) / (1000 * 60 * 60 * 24),
	};
});
root.api.session.user.administrator.ban = bt.dispatch(function(query, session, user) {
	var personUserID = parseInt(query.personUserID, 10);
	if(!personUserID) return {error: "Invalid person user ID"};
	db.query("DELETE FROM whitelist WHERE userID = $", [personUserID]);
	db.query("INSERT IGNORE INTO bannedSessions (modUserID, sessionID) SELECT $, sessionID FROM sessions WHERE userID = $", [user.info.userID, personUserID]);
	if(Session.byUserID.hasOwnProperty(personUserID)) Session.byUserID[personUserID].terminate();
	return true;
});

root.api.session.user.administrator.update = bt.dispatch();
root.api.session.user.administrator.update.files = bt.dispatch(function(query, session, user) {
	fileHandler.rescan();
	return true;
});
root.api.session.user.administrator.update.config = bt.dispatch(function(query, session, user) {
	config.update();
	return true;
});
root.api.session.user.administrator.update.database = bt.dispatch(function(query, session, user) {
	configureSessions();
	return true;
});
root.api.session.user.administrator.update.rankings = bt.dispatch(function(query, session, user) {
	updateRankings();
	return true;
});
root.api.session.user.administrator.update.channelAncestors = bt.dispatch(function(query, session, user) {
	db.query("LOCK TABLES channelAncestors WRITE, channelAncestors ca1 READ, channelAncestors ca2 READ, channels c READ");
	db.query("DELETE FROM channelAncestors WHERE 1");
	db.query("ALTER TABLE channelAncestors AUTO_INCREMENT = 0");
	db.query(
		"INSERT IGNORE INTO channelAncestors"+
		" (channelID, ancestorID) SELECT channelID, parentID"+
		" FROM channels c WHERE parentID IS NOT NULL"
	);
	(function recursivelyAddAncestors() {
		db.query(
			"INSERT IGNORE INTO channelAncestors"+
			" (channelID, ancestorID) SELECT ca1.channelID, ca2.ancestorID"+
			" FROM channelAncestors ca1"+
			" LEFT JOIN channelAncestors ca2 ON (ca1.ancestorID = ca2.channelID)"+
			" WHERE ca2.ancestorID IS NOT NULL",
			function(err, ancestorsResult) {
				if(ancestorsResult.affectedRows) recursivelyAddAncestors();
				else db.query("UNLOCK TABLES");
			}
		);
	})();
});

root.api.session.user.administrator.channel = bt.dispatch(null, function(func, query, session, user) {
	var channelID = query.channelID;
	if(undefined === channelID) return {error: "No channel ID specified"};
	if(!user.channelByID.hasOwnProperty(channelID)) return false;
	return func(query, session, user, user.channelByID[channelID]);
});
root.api.session.user.administrator.channel.empty = bt.dispatch(function(query, session, user, channel) {
	return session.promise(function(ticket) {
		channel.removeAllUsers(ticket);
		db.query(
			"DELETE FROM channelMembers"+
			" WHERE channelID = $ OR channelID IN"+
				" (SELECT channelID FROM channelAncestors WHERE ancestorID = $)",
			[channel.info.channelID, channel.info.channelID]
		);
	});
});

root.api.session.user.person = bt.dispatch(null, function(func, query, session, user) {
	var personUserID = parseInt(query.personUserID, 10);
	if(!personUserID) return {error: "Invalid person user ID"};
	return func(query, session, user, personUserID);
});
root.api.session.user.person.ignore = bt.dispatch(function(query, session, user, personUserID) {
	return session.promise(function(ticket) {
		if(query.ignore) {
			user.ignoringByUserID[personUserID] = true;
			db.query("INSERT IGNORE INTO ignores (userID, ignoredUserID) VALUES ($, $)", [user.info.userID, personUserID]);
		} else {
			delete user.ignoringByUserID[personUserID];
			db.query("DELETE FROM ignores WHERE userID = $ AND ignoredUserID = $", [user.info.userID, personUserID]);
		}
		var ignoringByUserID = {};
		ignoringByUserID[personUserID] = Boolean(query.ignore);
		user.sendEvent("/user/ignore/", {ignoringByUserID: ignoringByUserID}, ticket);
	});
});
root.api.session.user.person.rate = bt.dispatch(function(query, session, user, personUserID) {
	var rating = parseInt(query.rating, 10);
	if(isNaN(rating)) return {error: "Invalid rating"};
	if(query.rating < -1 || query.rating > 1) return {error: "Invalid rating"};
	db.query("UPDATE ratings SET isContradicted = 0 WHERE fromUserID = $ AND toUserID = $", [personUserID, user.info.userID]);
	db.query(
		"UPDATE ratings SET isContradicted = 1"+
		" WHERE fromUserID = $ AND toUserID = $ AND ratingType != $",
		[personUserID, user.info.userID, -rating],
		function(err, contradictedResult) {
			db.query(
				"REPLACE ratings (fromUserID, toUserID, ratingType, isContradicted)"+
				" VALUES ($, $, $, $)",
				[user.info.userID, personUserID, rating, (contradictedResult.affectedRows ? 1 : 0)]
			);
		}
	);
	return true;
});

root.api.session.user.channel = bt.dispatch(null, function(func, query, session, user) {
	var channelID = query.channelID;
	if(undefined === channelID) return {error: "No channel ID specified"};
	if(!user.channelByID.hasOwnProperty(channelID)) return false;
	return func(query, session, user, user.channelByID[channelID]);
});
root.api.session.user.channel.spawn = bt.dispatch(function(query, session, user, parentChannel) {
	if(parentChannel.game) return {error: "Subchannels cannot be spawned from game channels"};
	var topic = (query.topic || "").toString().replace(/^\s*|\s\s+|\s*$/g, "").slice(0, config.Channel.topic.length.max);
	if(!topic) {
		if(!parentChannel.info.allowsGameChannels) return false;
		topic = null;
	}
	return session.promise(function(ticket) {
		db.query(
			"INSERT INTO channels (parentID, topic)"+
			" VALUES ($, $)",
			[parentChannel.info.channelID, topic],
			function(err, channelResult) {
				var channelID = channelResult.insertId;
				assert.ok(!Channel.byID[channelID], "New channels must have unique IDs");
				var channel = new Channel(parentChannel.info.channelID, channelID);
				var ancestorValues = bt.map(channel.ancestors, function(ancestor) {
					return db.format("($, $)", channelID, ancestor.info.channelID);
				});
				var game;
				if(topic) {
					channel.info.topic = topic;
				} else {
					game = new Game(channel);
				}
				channel.addUser(user, ticket);
				if(ancestorValues.length) db.query(
					"INSERT IGNORE INTO channelAncestors (channelID, ancestorID)"+
					" VALUES #", [ancestorValues.join(", ")]
				);
				db.query(
					"INSERT IGNORE INTO channelMembers (channelID, userID, isCreator)"+
					" VALUES ($, $, 1)", [channelID, user.info.userID]
				);
			}
		);
	});
});
root.api.session.user.channel.invite = bt.dispatch(function(query, session, user, channel) {
	var invitedUser;
	if(user.inviteLimit()) return false;
	if(undefined === query.invitedUserID) return {error: "No invited userID specified"};
	if(!channel.parent) return {error: "Cannot invite to a root channel"};
	if(channel.memberByUserID.hasOwnProperty(query.invitedUserID)) return false;
	if(!channel.parent.memberByUserID.hasOwnProperty(query.invitedUserID)) return false;
	invitedUser = channel.parent.memberByUserID[query.invitedUserID];
	if(invitedUser.ignoringByUserID[user.info.userID]) return false;
	channel.addUser(invitedUser);
	if(channel.game) {
		delete channel.game.applicantByUserID[invitedUser.info.userID];
		if(channel.game.info.playersNeeded > 0) {
			channel.game.info.playersNeeded--;
			channel.group.sendEvent("/user/channel/game/", bt.union(channel.game.info, {channelID: channel.info.channelID}));
		}
		if(!channel.game.info.playersNeeded) channel.game.stopBroadcasting();
	}
	channel.group.sendEvent(
		"/user/channel/member/",
		{channelID: channel.info.channelID, memberUserID: invitedUser.info.userID, invitingUserID: user.info.userID, time: new Date().getTime()}
	);
	db.query(
		"INSERT IGNORE INTO channelMembers"+
		" (channelID, userID, invitedByUserID) VALUES ($, $, $)",
		[channel.info.channelID, invitedUser.info.userID, user.info.userID]
	);
	db.query(
		"SELECT channelModeratorID"+
		" FROM channelModerators"+
		" WHERE channelID = $ AND moderatorUserID = $"+
		" LIMIT 1",
		[channel.info.channelID, invitedUser.info.userID],
		function(err, modResult) {
			if(!modResult.length) return;
			invitedUser.moderatorChannelByID[channel.info.channelID] = channel;
			invitedUser.sendEvent("/user/channel/moderator/", {channelID: channel.info.channelID});
		}
	);
	return true;
});
root.api.session.user.channel.message = bt.dispatch(function(query, session, user, channel) {
	var text = query.text;
	if(user.messageLimit()) return false;
	if(undefined === text) return {error: "No message text specified"};
	text = text.toString().replace(/^\s*|\s*$/g, "");
	if(!text.length) return {error: "Message text has zero length (whitespace trimmed)"};
	return session.promise(function(ticket) {
		channel.sendMessage(user, text, ticket);
		// TODO: channel.autosave should be defined when the channel is created, but 1. the channel itself doesn't have access to the DB, and 2. channels are instantiated from several places.
		if(!channel.autosave) channel.autosave = limiter.batch(function() {
			db.query(
				"UPDATE channels SET historyJSON = $ WHERE channelID = $ LIMIT 1",
				[JSON.stringify(channel.history), channel.info.channelID]
			);
		}, config.Channel.autosave.delay);
		channel.autosave();
	});
});
root.api.session.user.channel.leave = bt.dispatch(function(query, session, user, channel) {
	channel.leaveRecursively(user, function(channelID) {
		db.query("DELETE FROM channelMembers WHERE userID = $ AND channelID = $ LIMIT 1", [user.info.userID, channelID]);
	});
	return true;
});
root.api.session.user.channel.report = bt.dispatch(function(query, session, user, channel) {
	db.query(
		"INSERT INTO reports (channelID, userID) VALUES ($, $)",
		[channel.info.channelID, user.info.userID],
		function(err, reportResult) {
			var values = channel.history.map(function(body) {
				return db.format(
					"($, $, $, FROM_UNIXTIME($))",
					reportResult.insertId, body.userID, body.text, Math.floor(body.time / 1000)
				);
			});
			if(values.length) db.query(
				"INSERT INTO reportMessages"+
				" (reportID, messageUserID, messageText, messageTime)"+
				" VALUES #",
				[values.join(", ")]
			);
		}
	);
	Group.administrators.sendEvent("/user/administrator/reports/", [{userName: user.info.userName, topic: channel.info.topic, time: new Date().getTime()}]);
	return true;
});

root.api.session.user.channel.moderator = bt.dispatch(null, function(func, query, session, user, channel) {
	var c;
	for(c = channel; c; c = c.parent) {
		if(!user.moderatorChannelByID.hasOwnProperty(c.info.channelID)) continue;
		if(c !== user.moderatorChannelByID[c.info.channelID]) continue;
		return func(query, session, user, channel);
	}
	return false;
});
root.api.session.user.channel.moderator.censor = bt.dispatch(function(query, session, user, channel) {
	if(!query.censorText) return {error: "No censored text specified"};
	if(!query.replacementText) return {error: "No replacement text specified"};
	var censorText = String(query.censorText), replacementText = String(query.replacementText);
	return session.promise(function(ticket) {
		bt.map(channel.history, function(body) {
			if(censorText !== body.text) return;
			body.text = replacementText;
			body.censored = true;
		});
		channel.privateGroup.sendEvent("/user/channel/censor/", {channelID: channel.info.channelID, censorText: censorText, replacementText: replacementText}, ticket);
		Group.administrators.sendEvent("/user/administrator/censored/", [{modUserName: user.info.userName, topic: channel.info.topic, time: new Date().getTime(), censorText: censorText, replacementText: replacementText}]);
		db.query("INSERT INTO censoredMessages (modUserID, channelID, censorText, replacementText) VALUES ($, $, $, $)", [user.info.userID, channel.info.channelID, censorText, replacementText]);
	});
});

root.api.session.user.channel.game = bt.dispatch(null, function(func, query, session, user, channel) {
	if(undefined === channel.game) return {error: "Specified channel is not a game channel"};
	return func(query, session, user, channel, channel.game);
});
root.api.session.user.channel.game.settings = bt.dispatch(function(query, session, user, channel, game) {
	var settings = [], didAnything;
	if(Session.config.matchTypes.hasOwnProperty(query.matchTypeID)) {
		game.info.matchTypeID = query.matchTypeID;
		settings.push(db.format("matchTypeID = $", game.info.matchTypeID));
		if(!Session.config.matchTypes[game.info.matchTypeID].hasTeams) bt.map(channel.teamIDByUserID, function(teamID, userID) {
			channel.teamIDByUserID[userID] = 0;
		});
		game.info.playersNeeded = Math.min(game.info.playersNeeded, Session.config.matchTypes[game.info.matchTypeID].playerCount - 1);
		didAnything = true;
	}
	if(Session.config.rules.hasOwnProperty(query.ruleID)) {
		game.info.ruleID = query.ruleID;
		settings.push(db.format("ruleID = $", game.info.ruleID));
		didAnything = true;
	}
	if(query.playersNeeded >= 0 && query.playersNeeded < Session.config.matchTypes[game.info.matchTypeID].playerCount) {
		game.info.playersNeeded = query.playersNeeded;
		if(0 == game.info.playersNeeded) game.stopBroadcasting();
		didAnything = true;
	}
	if(!didAnything) return false;
	if(settings.length) {
		db.query("INSERT IGNORE INTO games (channelID) VALUES ($)", [channel.info.channelID]);
		db.query("UPDATE games SET # WHERE channelID = $ LIMIT 1", [settings.join(", "), channel.info.channelID]);
	}
	return session.promise(function(ticket) {
		channel.group.sendEvent("/user/channel/game/", bt.union(game.info, {channelID: channel.info.channelID}), ticket);
	});
});

root.api.session.user.channel.game.member = bt.dispatch(null, function(func, query, session, user, channel, game) {
	if(!channel.memberByUserID.hasOwnProperty(query.memberUserID)) return false;
	return func(query, session, user, channel, game, channel.memberByUserID[query.memberUserID]);
});
root.api.session.user.channel.game.member.team = bt.dispatch(function(query, session, user, channel, game, member) {
	if(!Session.config.matchTypes[game.info.matchTypeID].hasTeams) return false;
	if(brawl.teams.colors.hasOwnProperty(query.teamID)) {
		if(query.teamID == channel.teamIDByUserID[member.info.userID]) return true;
		channel.teamIDByUserID[member.info.userID] = query.teamID;
	} else {
		if(!channel.teamIDByUserID.hasOwnProperty(member.info.userID)) return true;
		delete channel.teamIDByUserID[member.info.userID];
	}
	return session.promise(function(ticket) {
		channel.group.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: member.info.userID, teamID: channel.teamIDByUserID[member.info.userID]});
	});
});

root.api.session.user.channel.game.broadcast = bt.dispatch(function(query, session, user, channel, game) {
	if(user.channelLimit()) return false;
	if(!channel.parent) return {error: "Root channels cannot be broadcast"};
	if(user.broadcastCount && !game.broadcasting) return {error: "User is already a member of a broadcasting channel"};
	if(game.info.playersNeeded <= 0) return false;
	clearTimeout(game.broadcastTimeout);
	game.broadcastTimeout = setTimeout(game.stopBroadcasting, config.Game.broadcast.timeout);
	if(game.broadcasting) return true;
	return session.promise(function(ticket) {
		bt.map(channel.memberByUserID, function(member) {
			member.broadcastCount++;
		});
		channel.parent.broadcastingSubchannelByID[channel.info.channelID] = channel;
		channel.group = channel.parent.privateGroup;
		channel.sendInfoToTarget(channel.group);
		game.broadcasting = true;
		channel.group.sendEvent("/user/channel/game/broadcast/", {channelID: channel.info.channelID, broadcasterUserID: user.info.userID, time: new Date().getTime()}, ticket);
	});
}, function(func, query, session, user, channel, game) {
	if(!game.broadcasting) return false;
	return func(query, session, user, channel, game);
});
root.api.session.user.channel.game.broadcast.stop = bt.dispatch(function(query, session, user, channel, game) {
	return session.promise(function(ticket) {
		game.stopBroadcasting(user, ticket);
	});
});
root.api.session.user.channel.game.broadcast.deny = bt.dispatch(function(query, session, user, channel, game) {
	var applicantUserID = query.applicantUserID;
	if(!game.applicantByUserID.hasOwnProperty(applicantUserID)) return false;
	return session.promise(function(ticket) {
		delete game.applicantByUserID[user.info.userID];
		channel.group.sendEvent("/user/channel/game/broadcast/application/stop/", {channelID: channel.info.channelID, applicantUserID: applicantUserID, denierUserID: user.info.userID, time: new Date().getTime()}, ticket);
	});
});

root.api.session.user.publicChannel = bt.dispatch(null, function(func, query, session, user) {
	if(undefined === query.channelID) return {error: "No channel ID specified"};
	if(!Channel.public.byID.hasOwnProperty(query.channelID)) return false;
	return func(query, session, user, Channel.public.byID[query.channelID]);
});
root.api.session.user.publicChannel.join = bt.dispatch(function(query, session, user, channel) {
	if(user.channelLimit()) return false;
	if(user.channelByID.hasOwnProperty(channel.info.channelID)) return false;
	return session.promise(function(ticket) {
		// TODO: A lot of this is very similar to ...channel.invite. Can we reuse it?
		channel.addUser(user, ticket);
		channel.group.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: user.info.userID, time: new Date().getTime()});
		db.query("INSERT IGNORE INTO channelMembers (channelID, userID) VALUES ($, $)", [channel.info.channelID, user.info.userID]);
		db.query(
			"SELECT channelModeratorID"+
			" FROM channelModerators"+
			" WHERE channelID = $ AND moderatorUserID = $"+
			" LIMIT 1",
			[channel.info.channelID, user.info.userID],
			function(err, modResult) {
				if(!modResult.length) return;
				user.moderatorChannelByID[channel.info.channelID] = channel;
				user.sendEvent("/user/channel/moderator/", {channelID: channel.info.channelID});
			}
		);
	});
});

root.api.session.user.broadcastChannel = bt.dispatch(null, function(func, query, session, user) {
	var parentChannel, channel, id;
	if(undefined === query.channelID) return {error: "No channel ID specified"};
	for(id in user.channelByID) if(user.channelByID.hasOwnProperty(id)) {
		parentChannel = user.channelByID[id];
		if(!parentChannel.subchannelByID.hasOwnProperty(query.channelID)) continue;
		channel = parentChannel.subchannelByID[query.channelID];
		if(undefined === channel.game || !channel.game.broadcasting) break;
		return func(query, session, user, channel, channel.game);
	}
	return {error: "Specified channel not found"};
});
root.api.session.user.broadcastChannel.application = bt.dispatch(function(query, session, user, channel, game) {
	if(user.channelLimit()) return false;
	return session.promise(function(ticket) {
		game.applicantByUserID[user.info.userID] = user;
		channel.group.sendEvent("/user/channel/game/broadcast/application/", {channelID: channel.info.channelID, applicantUserID: user.info.userID, time: new Date().getTime()}, ticket);
	});
}, function(func, query, session, user, channel, game) {
	if(!game.applicantByUserID.hasOwnProperty(user.info.userID)) return {error: "User not a channel applicant"};
	return func(query, session, user, channel, game);
});
root.api.session.user.broadcastChannel.application.stop = bt.dispatch(function(query, session, user, channel, game) {
	return session.promise(function(ticket) {
		delete game.applicantByUserID[user.info.userID];
		channel.group.sendEvent("/user/channel/game/broadcast/application/stop/", {channelID: channel.info.channelID, applicantUserID: user.info.userID, time: new Date().getTime()}, ticket);
	});
});

root.api.session.user.video = bt.dispatch(function(query, session, user) {
	var youtubeID = query.youtubeID;
	if(user.videoLimit()) return false;
	if(!youtubeID) return {error: "No YouTube ID specified"};
	if(youtubeID.length != 11) return false;
	return session.promise(function(ticket) {
		db.query(
			"INSERT INTO videos (userID, youtubeID) VALUES ($, $)",
			[user.info.userID, youtubeID],
			function(err, result) {
				if(err && 1062 === err.number) return user.sendEvent("/videos/", {videoError: "Duplicate video"}, ticket);
				Group.sessions.sendEvent("/videos/", {old: false, videos: [{youtubeID: youtubeID, userName: user.info.userName, time: new Date().getTime()}]}, ticket);
			}
		);
	});
});

root.api.session.videos = bt.dispatch(function(query, session) {
	var start = Math.round(parseInt(query.start, 10)) || 0;
	var count = Math.round(parseInt(query.count, 10)) || 10;
	return session.promise(function(ticket) {
		db.query(
			"SELECT v.youtubeID, u.userName, UNIX_TIMESTAMP(v.submitTime) * 1000 time"+
			" FROM videos v"+
			" LEFT JOIN users u ON (v.userID = u.userID)"+
			" WHERE deleteTime IS NULL ORDER BY v.submitTime DESC LIMIT $, $",
			[start, count],
			function(err, result) {
				session.sendEvent("/videos/", {old: true, videos: mysql.rows(result)}, ticket);
			}
		);
	});
});

root.paypal = bt.dispatch(function(req, data) {
	db.query(
		"INSERT INTO donationAttempts (query)"+
		" VALUES ($)",
		[data]
	);
	var outgoing = new Buffer("cmd=_notify-validate&" + data, "utf8");
	var options = {
		port: 443,
		host: config.PayPal.host,
		path: "/cgi-bin/webscr",
		method: "POST",
		headers: {
			"content-length": outgoing.length,
		},
	};
	var req = https.request(options, function(res) {
		var confirm = "";
		if(200 != res.statusCode) return;
		res.setEncoding("utf8");
		res.addListener("data", function(chunk) {
			confirm += chunk;
		});
		res.addListener("end", function() {
			function verify(good, unknown) {
				for(var prop in good) if(good.hasOwnProperty(prop)) {
					if(good[prop] != unknown[prop]) return false;
				}
				return true;
			}
			function parsePennies(string) {
				var match = /(\d+)\.(\d{2})/.exec(string);
				if(!match) return 0;
				return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
			}
			if("VERIFIED" != confirm) return;
			var query = querystring.parse(data);
			var custom = JSON.parse(query["custom"]);
			var userID = parseInt(custom.userID, 10);
			if(!userID) return;
			if(!verify(config.PayPal.verify, query)) return;
			var pennies = parsePennies(query["mc_gross"] || query["mc_gross_1"]);
			if(config.PayPal.payment.pennies.min > pennies) return;
			if(config.PayPal.payment.pennies.max < pennies) return;
			if("Completed" != query["payment_status"]) return;
			// We shouldn't need to check the txn_type as long as the other conditions are met.
			db.query(
				"SELECT UNIX_TIMESTAMP(expireTime) * 1000 expireTime"+
				" FROM donations WHERE userID = $ AND expireTime > NOW()"+
				" ORDER BY expireTime DESC LIMIT 1",
				[userID],
				function(err, donationsResult) {
					var startTime = donationsResult.length ? mysql.rows(donationsResult)[0].expireTime : new Date().getTime();
					var additional = Math.ceil((((pennies / 4) * 3) * (1000 * 60 * 60 * 24 * (365.242199 / 12))) / 100);
					db.query(
						"INSERT IGNORE INTO donations (userID, payerID, transactionID, pennies, startTime, expireTime)"+
						" VALUES ($, $, $, $, FROM_UNIXTIME($ / 1000), DATE_SUB(FROM_UNIXTIME($ / 1000), INTERVAL ($ / -1000) SECOND))",
						[userID, query["payer_id"], query["txn_id"], pennies, startTime, startTime, additional],
						function(err, donationResult) {
							if(err && 1062 === err.number) return;
							if(err) throw err;
							if(!Session.byUserID.hasOwnProperty(userID)) return;
							var user = Session.byUserID[userID].user;
							if(user.info.subscriber) return;
							user.info.subscriber = true;
							Group.users.sendEvent("/user/person/", user.info);
							user.sendEvent("/user/subscription/", {expireTime: startTime + additional});
						}
					);
				}
			);
		});
	});
	req.end(outgoing);
});

http.createServer(root, fileHandler).listen(config.server.port, config.server.host);
