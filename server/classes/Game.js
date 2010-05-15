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
var sys = require("sys");

var bt = require("../../shared/bt");

var Game = function(channel) {
	var game = this;
	channel.game = game;
	game.info = {
		matchTypeID: 0,
		ruleID: 0,
		playersNeeded: 0,
	};
	game.broadcasting = false;
	game.applicantByUserID = {};
	game.broadcastTimeout = undefined;
	game.sendInfoToTarget = function(target) {
		target.sendEvent("/user/channel/game/", bt.union(game.info, {channelID: channel.info.channelID}));
		if(!game.broadcasting) return;
		target.sendEvent("/user/channel/game/broadcast/", {channelID: channel.info.channelID});
		bt.map(game.applicantByUserID, function(applicant, applicantUserID) {
			target.sendEvent("/user/channel/game/broadcast/application/", {channelID: channel.info.channelID, applicantUserID: applicantUserID});
		});
	};
	game.stopBroadcasting = function(user, ticket) {
		if(!game.broadcasting) return;
		assert.ok(channel.parent, "Root channels should never start broadcasting in the first place");
		game.broadcasting = false;
		clearTimeout(game.broadcastTimeout);
		channel.group.sendEvent("/user/channel/game/broadcast/stop/", {channelID: channel.info.channelID, stoppedUserID: (user ? user.info.userID : null), time: new Date().getTime()}, ticket);
		channel.group = channel.privateGroup;
		game.applicantByUserID = {};
		delete game.broadcastTimeout;
		delete channel.parent.broadcastingSubchannelByID[channel.info.channelID];
	};
};

exports.Game = Game;
