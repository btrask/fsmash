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
var util = require("util");

var bt = require("../../shared/bt");
var crypt = require("../utilities/crypt-wrapper");
var config = require("../config/");

var Group = require("./Group");
var User = require("./User");

var Session = function(remoteAddress) {
	var session = this;

	var promiseID = 0;
	var events = [], eventCallback, timeout;
	var sendEvents = function() {
		if(eventCallback) {
			eventCallback(events);
			eventCallback = null;
			events = [];
		}
		clearTimeout(timeout);
		timeout = setTimeout(session.terminate, config.Session.inactive.timeout);
	};

	session.remoteAddress = remoteAddress;
	session.info = {
		sessionID: ++Session.uniqueID,
		sessionKey: crypt.randomString(20)
	};
	Session.byID[session.info.sessionID] = session;
	Group.sessions.objects.push(session);

	session.signin = function(userID) {
		if(Session.byUserID.hasOwnProperty(userID)) Session.byUserID[userID].terminate();
		Group.users.objects.push(new User(session, userID));
	};
	session.terminate = function() {
		if(session.user) session.user.signout();
		delete Session.byID[session.info.sessionID];
		bt.array.removeObject(Group.sessions.objects, session);
	};

	session.sendEvent = function(path, event, ticket) {
		assert.ok(path);
		var obj = {path: path, body: event || {}};
		if(ticket && !ticket.used && ticket.session === session) {
			obj.promiseID = ticket.promiseID;
			ticket.used = true;
		}
		events.push(obj);
		process.nextTick(function() {
			if(!events.length) return;
			sendEvents();
		});
	};
	session.setEventCallback = function(func) {
		if(eventCallback) eventCallback({error: "Invalidated by an alternate session"});
		eventCallback = func;
		if(events.length) return sendEvents();
		clearTimeout(timeout);
		timeout = setTimeout(sendEvents, config.Session.active.timeout);
	}

	session.promise = function(func) {
		var pid = ++promiseID;
		func({session: session, promiseID: pid, used: false});
		return {promiseID: pid};
	};

	sendEvents();
};
Session.uniqueID = 0;
Session.byID = {};
Session.byUserID = {};
Session.config = {};

module.exports = Session;
