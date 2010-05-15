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
var bt = require("../../shared/bt");

var Group = require("./Group").Group;

var config = {
	maxBioLength: 141,
};

var User = function(session, userID) {
	var user = this;

	user.info = {
		userID: userID,
		idle: false,
	};
	user.channelByID = {};
	user.blockedByUserID = {};

	session.user = user;
	session.constructor.byUserID[user.info.userID] = session;

	user.sendEvent = session.sendEvent;
	user.signout = function() {
		bt.map(user.channelByID, function(channel) {
			channel.removeUser(user);
		});
		Group.users.sendEvent("/user/person/signout/", {userID: user.info.userID});
		bt.array.removeObject(Group.users.objects, user);
		bt.array.removeObject(Group.admins.objects, user);
		delete session.user;
		delete session.constructor.byUserID[user.info.userID];
	};
	user.setBio = function(string) {
		user.info.bio = string.slice(0, config.maxBioLength);
	};
};

exports.User = User;
