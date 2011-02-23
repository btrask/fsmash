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
var config = require("../config/");

var Group = require("./Group");

var User = function(session, userID) {
	var user = this;

	user.info = {
		userID: userID,
		idle: false,
		subscriber: false,
	};
	user.channelByID = {};
	user.moderatorChannelByID = {};
	user.ignoringByUserID = {};
	user.broadcastCount = 0;

	user.messageLimit = bt.limit(config.User.message.rate);
	user.inviteLimit = bt.limit(config.User.invite.rate);
	user.channelLimit = bt.limit(config.User.channel.rate);
	user.videoLimit = bt.limit(config.User.video.rate);

	session.user = user;
	session.constructor.byUserID[user.info.userID] = session;

	user.sendEvent = session.sendEvent;
	user.signout = function() {
		bt.map(user.channelByID, function(channel) {
			channel.removeUser(user);
		});
		Group.users.sendEvent("/user/person/signout/", {userID: user.info.userID});
		bt.array.removeObject(Group.users.objects, user);
		bt.array.removeObject(Group.administrators.objects, user);
		delete session.user;
		delete session.constructor.byUserID[user.info.userID];
	};
};

module.exports = User;
