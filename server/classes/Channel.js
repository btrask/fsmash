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

var Autosave = require("./Autosave");
var Group = require("./Group");
var Game = require("./Game");

var Channel = function(parentID, channelID) {
	var channel = this;
	var cacheTimeout = null;
	var autosavePath = path.join(__dirname, config.Channel.autosave.relativePath, channelID+".json");

	Channel.byID[channelID] = channel;
	Channel.count.active++;
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
		channel.autosave();
	};
	channel.addUser = function(user, ticket) {
		if(cacheTimeout) {
			Channel.count.inactive--;
			Channel.count.active++;
			clearTimeout(cacheTimeout);
			cacheTimeout = null;
		}
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
		bt.map(channel.broadcastingSubchannelByID, function(subchannel) {
			delete subchannel.game.applicantByUserID[user.info.userID];
		});
		if(channel.game && channel.game.broadcasting) user.broadcastCount--;
		if(!bt.hasOwnProperties(channel.memberByUserID)) {
			if(channel.game) channel.game.stopBroadcasting();
			channel.uncache();
		}
	};
	channel.removeAllUsers = function(ticket) {
		bt.map(channel.memberByUserID, function(user) {
			if(channel.game && channel.game.broadcasting) user.broadcastCount--;
			user.sendEvent("/user/channel/member/leave/", {channelID: channel.info.channelID, memberUserID: user.info.userID}, ticket);
			delete user.channelByID[channel.info.channelID];
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
			target.sendEvent("/user/channel/member/", {channelID: channel.info.channelID, memberUserID: parseInt(memberUserID), teamID: channel.teamIDByUserID[memberUserID]});
		});

		if(!isMember) return;
		target.sendEvent("/user/channel/history/", {channelID: channel.info.channelID, history: channel.history});
		bt.map(channel.broadcastingSubchannelByID, function(broadcastingSubchannel) {
			broadcastingSubchannel.sendInfoToTarget(target, false);
		});
	};
	channel.uncache = function(time) {
		var timeout = config.Channel.cache.timeout;
		if(!channel.parent) return;
		if(cacheTimeout) return;
		Channel.count.active--;
		Channel.count.inactive++;
		if(time) timeout = Math.max(1000 * 1, (time + config.Channel.cache.timeout) - new Date().getTime());
		cacheTimeout = setTimeout(bt.curry(function forgetSubchannels(c) {
			bt.map(c.subchannelByID, forgetSubchannels);
			if(Channel.byID.hasOwnProperty(c.info.channelID)) Channel.count.inactive--;
			delete Channel.byID[c.info.channelID];
			fs.unlink(autosavePath);
		}, channel), timeout);
	};
	channel.autosave = new Autosave(function() {
		fs.writeFile(autosavePath, JSON.stringify({
			time: new Date().getTime(),
			info: channel.info,
			history: channel.history,
			isGameChannel: Boolean(channel.game),
		}), "utf8");
	}, config.Channel.autosave.timeout);
};
Channel.byID = {};
Channel.public = {byID: {}};
Channel.count = {
	active: 0,
	inactive: 0,
};

(function loadFromAutosave() {
	var autosavePath = path.join(__dirname, config.Channel.autosave.relativePath);
	try {
		fs.mkdirSync(autosavePath, 0777);
	} catch(e) {
		if(constants.EEXIST !== e.errno) util.log(e);
	}
	var filenames = fs.readdirSync(autosavePath);
	filenames.sort(function(a, b) {
		return parseInt(a) - parseInt(b);
	});
	for(var i = 0; i < filenames.length; ++i) {
		var obj = JSON.parse(fs.readFileSync(path.join(autosavePath, filenames[i]), "utf8"));
		if(obj.info.parentID && !Channel.byID.hasOwnProperty(obj.info.parentID)) continue;
		var channel = new Channel(obj.info.parentID, obj.info.channelID);
		bt.mixin(channel.info, obj.info);
		channel.history = obj.history;
		if(obj.isGameChannel) new Game(channel);
		channel.uncache(obj.time);
	}
})();

module.exports = Channel;
