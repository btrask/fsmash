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
var sys = require("sys");

var crypt = require("./utilities/crypt-wrapper");
var crypto = require("./utilities/crypto-wrapper");
var http = require("./utilities/http-wrapper");
var mysql = require("./utilities/mysql-wrapper");

var bt = require("../shared/bt");
var brawl = require("../shared/brawl");

var Group = require("./classes/Group").Group;
var Session = require("./classes/Session").Session;
var Channel = require("./classes/Channel").Channel;
var Game = require("./classes/Game").Game;

var db = mysql.connect(JSON.parse(fs.readFileSync(__dirname+"/db.json", "utf8")));
var config = {
	server: JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8")),
	signin: {
		throttleMinutes: 15,
		throttleAttempts: 50,
	},
	signup: {
		allowed: true,
	},
	channel: {
		maxTopicLength: 40,
	},
	broadcast: {
		timeout: 1000 * 60 * 5,
	},
	rankings: {
		interval: 1000 * 60 * 60 * 1,
	},
	startTime: new Date().getTime(),
};

process.addListener("uncaughtException", function(err) {
	sys.log(err);
});

var fileHandler = bt.memoize(function(path, callback) {
	if(/\.\./.test(path)) return callback(403, {});
	if(/\/$/.test(path)) path += "index.html";
	path = __dirname+"/../public"+path;
	http.MIMEForPath(path, function(type) {
		if("text/" === type.slice(0, 5)) type += "; charset=UTF-8";
		fs.readFile(path+".gz", function(err, data) {
			if(err) return callback(2 == err.errno ? 404 : 500, {})
			return callback(200, {
				"Content-Encoding": "gzip",
				"Content-Type": type,
				"Content-Length": data.length,
			}, data);
		});
	});
});
var configureSessions = (function configureSessions() {
	db.query(
		"SELECT soundsetID, label, path, challenge, `join`, `leave`, message"+
		" FROM soundsets WHERE 1 ORDER BY sortOrder ASC",
		function(soundsetsResult) {
			Session.config.soundsets = mysql.rows(soundsetsResult);
		}
	);
	db.query(
		"SELECT pc.channelID, c.topic, c.allowsGameChannels, pc.descriptionHTML"+
		" FROM publicChannels pc"+
		" LEFT JOIN channels c ON (pc.channelID = c.channelID)"+
		" WHERE 1 ORDER BY pc.sortOrder ASC",
		function(channelsResult) {
			var channelRows = mysql.rows(channelsResult), channel;
			Session.config.publicChannels = channelRows;
			Channel.public.byID = {};
			channelRows.map(function(channelRow) {
				if(Channel.byID.hasOwnProperty(channelRow.channelID)) channel = Channel.byID[channelRow.channelID];
				else channel = new Channel(null, channelRow.channelID);
				channel.info.topic = channelRow.topic;
				channel.info.allowsGameChannels = !!Number(channelRow.allowsGameChannels);
				Channel.public.byID[channelRow.channelID] = channel;
			});
		}
	);
	db.query(
		"SELECT matchTypeID, label, hasTeams, playerCount"+
		" FROM matchTypes WHERE 1 ORDER BY sortOrder ASC",
		function(matchTypesResult) {
			Session.config.matchTypes = mysql.rows(matchTypesResult);
			bt.map(Session.config.matchTypes, function(matchType) {
				matchType.hasTeams = ("1" == matchType.hasTeams);
			});
		}
	);
	db.query(
		"SELECT ruleID, label"+
		" FROM rules WHERE 1 ORDER BY sortOrder ASC",
		function(rulesResult) {
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
setInterval(updateRankings, config.rankings.interval);

var root = bt.dispatch();
root.api = bt.dispatch();

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
root.api.session.terminate = bt.dispatch(function(query, session, user) {
	session.terminate();
	return true;
});
root.api.session.watch = bt.dispatch(function(query, session) {
	return function(req, res) {
		session.setEventCallback(bt.curry(http.writeJSON, res));
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
			if(query.password.length < 5) return accountError("Passwords must be at least 5 characters");
			db.query(mysql.format(
				"SELECT * FROM sessions WHERE ipAddress = INET_ATON($) LIMIT 1",
				query.remoteAddress), function(sessionsResult) {
					if(sessionsResult.records.length) return accountError("You already have an account");
					db.query(mysql.format(
						"INSERT INTO users (userName, passHash2) VALUES ($, $)",
						query.userName, crypt.hash(query.password)),
						function(userResult) {
							var userID = userResult.insert_id;
							db.query(mysql.format(
								"INSERT IGNORE INTO settings (userID) VALUES ($)",
								userID
							));
							logSession(userID, query.userName);
						}, function(error) {
							if("ER_DUP_ENTRY" === error.error_name) return accountError("Username already in use");
							session.sendEvent("/user/", {error: "Database error: "+error}, ticket);
						}
					);
				}
			);
		};
		var signin = function() {
			db.query(mysql.format(
				"INSERT INTO signinAttempts (ipAddress, userName)"+
				" VALUES (INET_ATON($), $)",
				query.remoteAddress, query.userName
			));
			db.query(mysql.format(
				"SELECT COUNT(*) FROM signinAttempts"+
				" WHERE ipAddress = $ AND signinTime > DATE_SUB(NOW(), INTERVAL $ MINUTE)",
				query.remoteAddress, config.signin.throttleMinutes),
				function(signinResult) {
					if(signinResult.records[0][0] > config.signin.throttleAttempts) return accountError("Too many signin attempts");
					if(query.userToken) {
						db.query(mysql.format(
							"SELECT u.userID, u.userName"+
							" FROM users u"+
							" LEFT JOIN tokens t ON (u.userID = t.userID)"+
							" WHERE u.userName = $ AND t.token = $ LIMIT 1",
							query.userName, query.userToken), function(userResult) {
								if(!userResult.records.length) return accountError("Invalid token");
								var userRow = mysql.rows(userResult)[0];
								logSession(userRow.userID, userRow.userName);
							}
						);
					} else {
						var legacyPassHash = crypto.SHA1(query.password);
						db.query(mysql.format(
							"SELECT userID, userName, passHash2 passHash FROM users"+
							" WHERE userName = $ AND (passHash2 IS NOT NULL OR passHash = $) LIMIT 1",
							query.userName, legacyPassHash), function(userResult) {
								if(!userResult.records.length) return accountError("Incorrect username or password");
								var userRow = mysql.rows(userResult)[0];
								if(userRow.passHash) {
									if(!crypt.check(query.password, userRow.passHash)) return accountError("Incorrect username or password");
								} else {
									db.query(mysql.format(
										"UPDATE users SET passHash = NULL, passHash2 = $"+
										" WHERE userID = $ AND passHash = $ LIMIT 1",
										crypt.hash(query.password), userRow.userID, legacyPassHash
									));
								}
								logSession(userRow.userID, userRow.userName);
							}
						);
					}
				}
			);
		};
		var logSession = function(userID, userName) {
			db.query(mysql.format(
				"INSERT INTO sessions (userID, ipAddress)"+
				" VALUES ($, INET_ATON($))",
				userID, query.remoteAddress
			));
			db.query(mysql.format(
				"SELECT bs.sessionID FROM bannedSessions bs"+
				" LEFT JOIN sessions s ON (bs.sessionID = s.sessionID)"+
				" WHERE s.userID = $ OR s.ipAddress = INET_ATON($) LIMIT 1",
				userID, query.remoteAddress), function(bannedSessionResult) {
					if(bannedSessionResult.records.length) return recordBan(userID, mysql.rows(bannedSessionResult)[0].sessionID);
					db.query(mysql.format(
						"SELECT bannedIPID"+
						" FROM bannedIPs"+
						" WHERE minIPAddress <= INET_ATON($) AND maxIPAddress >= INET_ATON($)",
						query.remoteAddress, query.remoteAddress),
						function(bannedIPResult) {
							if(bannedIPResult.records.length) return recordBan(userID);
							loadUser(userID, userName);
						}
					);
				}
			);
		};
		var recordBan = function(userID, dependentSession) {
			db.query(mysql.format(
				"INSERT IGNORE INTO bannedSessions"+
				" (dependentSessionID, sessionID) SELECT $, sessionID"+
				" FROM sessions"+
				" WHERE userID = $ OR ipAddress = INET_ATON($)",
				dependentSession || null, userID, query.remoteAddress
			));
			accountError("You are banned");
		};
		var loadUser = function(userID, userName) {
			session.signin(userID);
			var user = session.user;
			user.info.userName = userName;
			db.query(mysql.format(
				"SELECT brawlName, friendCode, bio FROM profiles"+
				" WHERE userID = $ LIMIT 1",
				user.info.userID), function(profileResult) {
					if(profileResult.records.length) bt.mixin(user.info, mysql.rows(profileResult)[0]);
				}
			);
			db.query(mysql.format(
				"SELECT regions.name region, countries.name country FROM ip_group_city cities"+
				" LEFT JOIN locations l ON (cities.location = l.id)"+
				" LEFT JOIN iso3166_countries countries ON (l.country_code = countries.code)"+
				" LEFT JOIN fips_regions regions ON (l.country_code = regions.country_code AND l.region_code = regions.code)"+
				" WHERE ip_start <= INET_ATON($) ORDER BY ip_start DESC LIMIT 1",
				query.remoteAddress), function(locationResult) {
					if(!locationResult.records.length) return;
					user.info.location = bt.array.unique(bt.map(locationResult.records[0], function(value) {
						return value || undefined;
					})).join(", ");
				}
			);
			db.query(mysql.format(
				"SELECT totalPoints FROM rankings WHERE userID = $ LIMIT 1",
				user.info.userID),
				function(pointsResult) {
					if(!pointsResult.records.length) return loadChannels(user);
					db.query(mysql.format(
						"SELECT COUNT(*) + 1 rank FROM rankings WHERE totalPoints > $",
						mysql.rows(pointsResult)[0].totalPoints),
						function(rankResult) {
							user.info.rank = mysql.rows(rankResult)[0].rank;
							loadChannels(user);
						}
					);
				}
			);
		};
		var loadChannels = function(user) {
			db.query(mysql.format(
				"SELECT cm.channelID, c.parentID, c.topic, c.allowsGameChannels, g.matchTypeID, g.ruleID"+
				" FROM channelMembers cm"+
				" LEFT JOIN channels c ON (cm.channelID = c.channelID)"+
				" LEFT JOIN games g ON (cm.channelID = g.channelID)"+
				" WHERE cm.userID = $ ORDER BY cm.channelID ASC",
				user.info.userID), function(channelResult) {
					sendUser(user);
					mysql.rows(channelResult).map(function(channelRow) {
						var channel, game;
						if(Channel.byID.hasOwnProperty(channelRow.channelID)) channel = Channel.byID[channelRow.channelID];
						else {
							channel = new Channel(channelRow.parentID, channelRow.channelID);
							channel.info.allowsGameChannels = !!Number(channelRow.allowsGameChannels);
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
					});
				}
			);
		};
		var sendUser = function(user) {
			session.sendEvent("/user/", user.info, ticket);
			user.sendEvent("/user/config/", Session.config);
			Group.users.sendEvent("/user/person/", user.info);
			bt.map(Session.byUserID, function(otherSession, otherUserID) {
				if(otherUserID === user.info.userID) return;
				session.sendEvent("/user/person/", otherSession.user.info);
			});
			db.query(mysql.format(
				"SELECT styleID, soundsetID FROM settings WHERE userID = $ LIMIT 1",
				user.info.userID),
				function(settingsResult) {
					if(!settingsResult.records.length) return;
					user.sendEvent("/user/settings/", mysql.rows(settingsResult)[0]);
				}
			);
			db.query(mysql.format(
				"SELECT adminID FROM admins WHERE userID = $ LIMIT 1",
				user.info.userID),
				function(adminResult) {
					if(!adminResult.records.length) return;
					user.admin = true;
					Group.admins.objects.push(user);
					user.sendEvent("/user/admin/", {signupAllowed: config.signup.allowed});
					db.query(mysql.format(
						"SELECT u.userName, c.topic, UNIX_TIMESTAMP(r.reportTime) * 1000 time"+
						" FROM reports r"+
						" LEFT JOIN users u ON (r.userID = u.userID)"+
						" LEFT JOIN channels c ON (r.channelID = c.channelID)"+
						" WHERE r.reportTime > DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.isResolved = 0"+
						" ORDER BY r.reportTime DESC"),
						function(reportResults) {
							user.sendEvent("/user/admin/reports/", mysql.rows(reportResults));
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
root.api.session.user.remember = bt.dispatch(function(query, session, user) {
	var token = crypt.randomString(50);
	db.query(mysql.format("REPLACE tokens (userID, token) VALUES ($, $)", user.info.userID, token));
	return {token: token};
});
root.api.session.user.settings = bt.dispatch(function(query, session, user) {
	var settings = [];
	if(undefined !== query.styleID) {
		settings.push(mysql.format("styleID = $", Number(query.styleID)));
	}
	if(undefined !== query.soundsetID) {
		settings.push(mysql.format("soundsetID = $", Number(query.soundsetID)));
	}
	if(settings.length) {
		db.query(mysql.format("INSERT IGNORE INTO settings (userID) VALUES ($)", user.info.userID));
		db.query(mysql.format("UPDATE settings SET # WHERE userID = $ LIMIT 1", settings.join(", "), user.info.userID));
	}
	return true;
});
root.api.session.user.profile = bt.dispatch(function(query, session, user) {
	var fields = [];
	if(undefined !== query.brawlName) {
		user.info.brawlName = brawl.brawlName(query.brawlName.toString());
		fields.push(mysql.format("brawlName = $", user.info.brawlName));
	}
	if(undefined !== query.friendCode) {
		user.info.friendCode = brawl.friendCode(query.friendCode.toString(), "");
		fields.push(mysql.format("friendCode = $", user.info.friendCode));
	}
	if(undefined !== query.bio) {
		user.setBio(query.bio.toString());
		fields.push(mysql.format("bio = $", user.info.bio));
	}
	if(!fields.length) return false;
	return session.promise(function(ticket) {
		Group.users.sendEvent("/user/person/", user.info, ticket);
		db.query(mysql.format(
			"INSERT IGNORE INTO profiles (userID)"+
			" VALUES ($)",
			user.info.userID), function() {
				db.query(mysql.format(
					"UPDATE profiles SET #"+
					" WHERE userID = $ LIMIT 1",
					fields.join(", "), user.info.userID
				));
			}
		);
	});
});
root.api.session.user.idle = bt.dispatch(function(query, session, user) {
	if(!query.idle === !user.info.idle) return true;
	return session.promise(function(ticket) {
		user.info.idle = !!query.idle;
		Group.users.sendEvent("/user/person/", user.info, ticket);
	});
});

root.api.session.user.admin = bt.dispatch(null, function(func, query, session, user) {
	if(!user.admin) return {error: "Admin permissions required"};
	return func(query, session, user);
});
root.api.session.user.admin.uncache = bt.dispatch(function(query, session, user) {
	fileHandler.uncache();
	return true;
});
root.api.session.user.admin.reconfigure = bt.dispatch(function(query, session, user) {
	configureSessions();
	return true;
});
root.api.session.user.admin.signups = bt.dispatch(function(query, session, user) {
	config.signup.allowed = !!query.signupAllowed;
	return {signupAllowed: config.signup.allowed};
});
root.api.session.user.admin.rankings = bt.dispatch(function(query, session, user) {
	updateRankings();
	return true;
});
root.api.session.user.admin.statistics = bt.dispatch(function(query, session, user) {
	return bt.union(process.memoryUsage(), {
		platform: process.platform,
		version: process.version,
		sessions: Group.sessions.objects.length,
		users: Group.users.objects.length,
		uptime: (new Date().getTime() - config.startTime) / (1000 * 60 * 60 * 24),
	});
});
root.api.session.user.admin.ban = bt.dispatch(function(query, session, user) {
	var personUserID = query.personUserID;
	if(Number(personUserID) !== personUserID) return {error: "Invalid person user ID"};
	db.query(mysql.format("INSERT IGNORE INTO bannedSessions (modUserID, sessionID) SELECT $, sessionID FROM sessions WHERE userID = $", user.info.userID, personUserID));
	if(Session.byUserID.hasOwnProperty(personUserID)) Session.byUserID[personUserID].terminate();
	return true;
});

root.api.session.user.person = bt.dispatch(null, function(func, query, session, user) {
	var personUserID = query.personUserID;
	if(Number(personUserID) !== personUserID) return {error: "Invalid person user ID"};
	return func(query, session, user, personUserID);
});
root.api.session.user.person.block = bt.dispatch(function(query, session, user, personUserID) {
	user.blockedByUserID[personUserID] = !!query.block;
	return true;
});
root.api.session.user.person.rate = bt.dispatch(function(query, session, user, personUserID) {
	var rating = query.rating;
	if(Number(rating) !== rating) return {error: "Invalid rating"};
	if(query.rating < -1 || query.rating > 1) return {error: "Invalid rating"};
	db.query(mysql.format(
		"UPDATE ratings SET isContradicted = 0"+
		" WHERE fromUserID = $ AND toUserID = $",
		personUserID, user.info.userID),
		function() {
			db.query(mysql.format(
				"UPDATE ratings SET isContradicted = 1"+
				" WHERE fromUserID = $ AND toUserID = $ AND ratingType != $",
				personUserID, user.info.userID, -rating),
				function(contradictedResult) {
					db.query(mysql.format(
						"REPLACE ratings (fromUserID, toUserID, ratingType, isContradicted)"+
						" VALUES ($, $, $, $)",
						user.info.userID, personUserID, rating, (contradictedResult.affected_rows ? 1 : 0)
					));
				}
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
	var topic = (query.topic || "").toString().replace(/^\s*|\s\s+|\s*$/g, "").slice(0, config.channel.maxTopicLength);
	if(!topic) {
		if(!parentChannel.info.allowsGameChannels) return false;
		topic = null;
	}
	return session.promise(function(ticket) {
		db.query(mysql.format(
			"INSERT INTO channels (parentID, topic)"+
			" VALUES ($, $)",
			parentChannel.info.channelID, topic), function(channelResult) {
				var channelID = channelResult.insert_id;
				assert.ok(!Channel.byID[channelID], "New channels must have unique IDs");
				var channel = new Channel(parentChannel.info.channelID, channelID);
				var game;
				if(topic) {
					channel.info.topic = topic;
				} else {
					game = new Game(channel);
				}
				channel.addUser(user, ticket);
				db.query(mysql.format(
					"INSERT IGNORE INTO channelMembers (channelID, userID, isCreator)"+
					" VALUES ($, $, 1)", channelResult.insert_id, user.info.userID
				));
			}
		);
	});
});
root.api.session.user.channel.invite = bt.dispatch(function(query, session, user, channel) {
	var invitedUser;
	if(undefined === query.invitedUserID) return {error: "No invited userID specified"};
	if(!channel.parent) return {error: "Cannot invite to a root channel"};
	if(channel.memberByUserID.hasOwnProperty(query.invitedUserID)) return false;
	if(!channel.parent.memberByUserID.hasOwnProperty(query.invitedUserID)) return false;
	invitedUser = channel.parent.memberByUserID[query.invitedUserID];
	if(invitedUser.blockedByUserID[user.info.userID]) return false;
	channel.addUser(invitedUser);
	if(channel.game) {
		delete channel.game.applicantByUserID[invitedUser.info.userID];
		if(channel.game.info.playersNeeded > 0) {
			channel.game.info.playersNeeded--;
			channel.group.sendEvent("/user/channel/game/", bt.union(channel.game.info, {channelID: channel.info.channelID}));
		}
		if(!channel.game.info.playersNeeded) channel.game.stopBroadcasting();
	}
	channel.group.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: invitedUser.info.userID, invitingUserID: user.info.userID, time: new Date().getTime()});
	db.query(mysql.format("INSERT IGNORE INTO channelMembers (channelID, userID) VALUES ($, $)", channel.info.channelID, invitedUser.info.userID));
	return true;
});
root.api.session.user.channel.message = bt.dispatch(function(query, session, user, channel) {
	var text = query.text;
	if(undefined === text) return {error: "No message text specified"};
	text = text.toString().replace(/^\s*|\s*$/g, "");
	if(!text.length) return {error: "Message text has zero length (whitespace trimmed)"};
	return session.promise(function(ticket) {
		channel.sendMessage(user, text, ticket);
	});
});
root.api.session.user.channel.leave = bt.dispatch(function(query, session, user, channel) {
	channel.leaveRecursively(user, function(channelID) {
		db.query(mysql.format("DELETE FROM channelMembers WHERE userID = $ AND channelID = $ LIMIT 1", user.info.userID, channelID));
	});
	return true;
});
root.api.session.user.channel.report = bt.dispatch(function(query, session, user, channel) {
	db.query(mysql.format(
		"INSERT INTO reports (channelID, userID) VALUES ($, $)",
		channel.info.channelID, user.info.userID),
		function(reportResult) {
			var values = channel.history.map(function(body) {
				return mysql.format(
					"($, $, $, FROM_UNIXTIME($))",
					reportResult.insert_id, body.userID, body.text, Math.floor(body.time / 1000)
				);
			});
			if(values.length) db.query(mysql.format(
				"INSERT INTO reportMessages"+
				" (reportID, messageUserID, messageText, messageTime)"+
				" VALUES #",
				values.join(", ")
			));
		}
	);
	Group.admins.sendEvent("/user/admin/reports/", [{userName: user.info.userName, topic: channel.info.topic, time: new Date().getTime()}]);
	return true;
});

root.api.session.user.channel.game = bt.dispatch(null, function(func, query, session, user, channel) {
	if(undefined === channel.game) return {error: "Specified channel is not a game channel"};
	return func(query, session, user, channel, channel.game);
});
root.api.session.user.channel.game.settings = bt.dispatch(function(query, session, user, channel, game) {
	var settings = [], didAnything;
	if(Session.config.matchTypes.hasOwnProperty(query.matchTypeID)) {
		game.info.matchTypeID = query.matchTypeID;
		settings.push(mysql.format("matchTypeID = $", game.info.matchTypeID));
		if(!Session.config.matchTypes[game.info.matchTypeID].hasTeams) bt.map(channel.teamIDByUserID, function(teamID, userID) {
			channel.teamIDByUserID[userID] = 0;
		});
		game.info.playersNeeded = Math.min(game.info.playersNeeded, Session.config.matchTypes[game.info.matchTypeID].playerCount - 1);
		didAnything = true;
	}
	if(Session.config.rules.hasOwnProperty(query.ruleID)) {
		game.info.ruleID = query.ruleID;
		settings.push(mysql.format("ruleID = $", game.info.ruleID));
		didAnything = true;
	}
	if(query.playersNeeded >= 0 && query.playersNeeded < Session.config.matchTypes[game.info.matchTypeID].playerCount) {
		game.info.playersNeeded = query.playersNeeded;
		if(0 == game.info.playersNeeded) game.stopBroadcasting();
		didAnything = true;
	}
	if(!didAnything) return false;
	if(settings.length) db.query(mysql.format(
		"INSERT IGNORE INTO games (channelID) VALUES ($)",
		channel.info.channelID), function() {
			db.query(mysql.format(
				"UPDATE games SET # WHERE channelID = $ LIMIT 1",
				settings.join(", "), channel.info.channelID
			));
		}
	);
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
	if(!channel.parent) return {error: "Root channels cannot be broadcast"};
	if(user.broadcastCount && !game.broadcasting) return {error: "User is already a member of a broadcasting channel"};
	if(!(game.info.playersNeeded > 0)) return false;
	clearTimeout(game.broadcastTimeout);
	game.broadcastTimeout = setTimeout(game.stopBroadcasting, config.broadcast.timeout);
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
	if(user.channelByID.hasOwnProperty(channel.info.channelID)) return false;
	return session.promise(function(ticket) {
		channel.addUser(user, ticket);
		channel.group.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: user.info.userID, time: new Date().getTime()});
		db.query(mysql.format("INSERT IGNORE INTO channelMembers (channelID, userID) VALUES ($, $)", channel.info.channelID, user.info.userID));
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
	if(!youtubeID) return {error: "No YouTube ID specified"};
	if(youtubeID.length != 11) return false;
	return session.promise(function(ticket) {
		db.query(mysql.format(
			"INSERT INTO videos (userID, youtubeID) VALUES ($, $)",
			user.info.userID, youtubeID),
			function(result) {
				Group.sessions.sendEvent("/videos/", {old: false, videos: [{youtubeID: youtubeID, userName: user.info.userName, time: new Date().getTime()}]}, ticket);
			}, function(error) {
				if("ER_DUP_ENTRY" === error.error_name) return user.sendEvent("/videos/", {videoError: "Duplicate video"}, ticket);
				user.sendEvent("/videos/", {error: "Database error: "+error}, ticket);
			}
		);
	});
});

root.api.session.videos = bt.dispatch(function(query, session) {
	var start = Math.round(Number(query.start)) || 0;
	var count = Math.round(Number(query.count)) || 10;
	return session.promise(function(ticket) {
		db.query(mysql.format(
			"SELECT v.youtubeID, u.userName, FROM_UNIXTIME(v.submitTime) * 1000 time"+
			" FROM videos v"+
			" LEFT JOIN users u ON (v.userID = u.userID)"+
			" WHERE 1 ORDER BY v.submitTime DESC LIMIT $, $",
			start, count), function(result) {
				session.sendEvent("/videos/", {old: true, videos: mysql.rows(result)}, ticket);
			}
		);
	});
});

http.createServer(root, fileHandler).listen(config.server.port, config.server.host);
