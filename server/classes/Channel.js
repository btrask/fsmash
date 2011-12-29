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
var constants = require("constants");
var fs = require("fs");
var path = require("path");
var util = require("util");

var bt = require("../../shared/bt");
var config = require("../config/");

var Group = require("./Group");
var Game = require("./Game");

var Channel = function(parentID, channelID) {
	var channel = this;

	Channel.byID[channelID] = channel;
	Channel.count++;
	channel.info = {
		channelID: channelID,
		parentID: parentID,
		allowsGameChannels: true,
	};
	channel.privateGroup = new Group();
	channel.group = channel.privateGroup;
	channel.memberByUserID = {};
	channel.teamIDByUserID = {};
	channel.subchannelByID = {};
	channel.broadcastingSubchannelByID = {};
	channel.history = [];
	channel.ancestors = [];
	if(parentID) {
		assert.ok(Channel.byID.hasOwnProperty(parentID), "Invalid channel parent");
		channel.parent = Channel.byID[parentID];
		channel.parent.subchannelByID[channelID] = channel;
		channel.ancestors = [channel.parent].concat(channel.parent.ancestors);
	}
	channel.sendMessage = function(user, message, ticket) {
		var body = {
			userID: user.info.userID,
			userName: user.info.userName,
			text: message.slice(0, config.Channel.message.length.max),
			time: new Date().getTime(),
		};
		channel.privateGroup.sendEvent("/user/channel/message/", bt.union(body, {channelID: channel.info.channelID}), ticket);
		channel.history.push(body);
		while(channel.history.length > config.Channel.history.length.max) channel.history.shift();
	};
	channel.addUser = function(user, ticket) {
		user.channelByID[channel.info.channelID] = channel;
		channel.memberByUserID[user.info.userID] = user;
		if(!channel.teamIDByUserID.hasOwnProperty(user.info.userID)) channel.teamIDByUserID[user.info.userID] = 0;
		if(-1 === channel.privateGroup.objects.indexOf(user)) {
			channel.privateGroup.objects.push(user);
			if(channel.game && channel.game.broadcasting) user.broadcastCount++;
		}
		channel.sendInfoToTarget(user, true, ticket);
	};
	channel.removeUser = function(user) {
		var i = channel.privateGroup.objects.indexOf(user);
		if(-1 === i) return;
		channel.privateGroup.objects.splice(i, 1);
		delete channel.memberByUserID[user.info.userID];
		delete user.channelByID[channel.info.channelID];
		delete user.moderatorChannelByID[channel.info.channelID];
		bt.map(channel.broadcastingSubchannelByID, function(subchannel) {
			delete subchannel.game.applicantByUserID[user.info.userID];
		});
		if(channel.game) {
			if(channel.game.broadcasting) user.broadcastCount--;
			channel.game.stopBroadcasting();
		}
		if(!bt.hasOwnProperties(channel.memberByUserID)) channel.uncache();
	};
	channel.removeAllUsers = function(ticket) {
		bt.map(channel.memberByUserID, function(user) {
			if(channel.game && channel.game.broadcasting) user.broadcastCount--;
			user.sendEvent("/user/channel/member/leave/", {channelID: channel.info.channelID, memberUserID: user.info.userID}, ticket);
			delete user.channelByID[channel.info.channelID];
			delete user.moderatorChannelByID[channel.info.channelID];
		});
		channel.memberByUserID = {};
		channel.privateGroup.objects = [];
		if(channel.game) channel.game.stopBroadcasting();
		channel.uncache();
	};
	channel.leaveRecursively = function(user, callback/* channelID */) {
		if(-1 === channel.privateGroup.objects.indexOf(user)) return;
		bt.map(channel.subchannelByID, function(subchannel) {
			subchannel.leaveRecursively(user, callback);
		});
		channel.group.sendEvent("/user/channel/member/leave/", {channelID: channel.info.channelID, memberUserID: user.info.userID, time: new Date().getTime()});
		channel.removeUser(user);
		if(callback) callback(channel.info.channelID);
	};
	channel.sendInfoToTarget = function(target, isMember, ticket) {
		target.sendEvent("/user/channel/", channel.info, ticket);

		if(channel.game) channel.game.sendInfoToTarget(target);

		bt.map(channel.memberByUserID, function(member, memberUserID) {
			target.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: parseInt(memberUserID, 10), teamID: channel.teamIDByUserID[memberUserID]});
		});

		if(!isMember) return;
		target.sendEvent("/user/channel/history/", {channelID: channel.info.channelID, history: channel.history});
		bt.map(channel.broadcastingSubchannelByID, function(broadcastingSubchannel) {
			broadcastingSubchannel.sendInfoToTarget(target, false);
		});
	};
	channel.isCompletelyIgnoringUser = function(user) {
		for(var memberUserID in channel.memberByUserID) if(channel.memberByUserID.hasOwnProperty(memberUserID)) {
			if(!channel.memberByUserID[memberUserID].ignoringByUserID[user.info.userID]) return false;
		}
		return true;
	};
	channel.uncache = function() {
		var isBaseChannel = !channel.parent;
		var canUncache = !isBaseChannel;
		if(canUncache) (function forgetSubchannels(c) {
			bt.map(c.subchannelByID, forgetSubchannels);
			c.memberByUserID = {};
			c.privateGroup.objects = [];
			delete Channel.byID[c.info.channelID];
			Channel.count--;
		})(channel);
	};
};
Channel.byID = {};
Channel.public = {byID: {}};
Channel.count = 0;

module.exports = Channel;
