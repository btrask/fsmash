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
var Game = function(session, user, channel) {
	var game = this;

	var setBroadcasting = function(flag) {
		if(flag == game.broadcasting) return;
		game.broadcasting = !!flag;
		if(channel.userIsMember) user.setBroadcasting(game.broadcasting);
	};
	var updateIsBroadcasting = function() {
		DOM.changeClass(channel.sidebarItem.row, "notice", game.broadcasting);
		DOM.changeClass(game.groups.applicants.element, "invisible", !game.broadcasting);
		game.update();
	};

	var userIsApplicant = false;
	var announcementElems = {};
	var announcement;

	game.broadcasting = false;
	game.info = {
		matchTypeID: 0,
		ruleID: 0
	};
	game.applicantByUserID = {};

	(function() {
		var acceptAction = function(validate, item) {
			if(validate) {
				this.value = "Accept";
				return channel.userIsMember;
			}
			channel.request("/invite/", {invitedUserID: item.person.info.userID});
		};
		var denyAction = function(validate, item) {
			if(validate) {
				this.value = "Deny";
				return channel.userIsMember;
			}
			game.request("/broadcast/deny/", {applicantUserID: item.person.info.userID});
		};

		game.groups = {
			applicants: new Group("Applicants", [acceptAction, denyAction])
		};

		game.groups.applicants.onadd = function(item) {
			DOM.changeClass(item.element, "notice", true);
		};
		game.groups.applicants.onremove = function(item) {
			DOM.changeClass(item.element, "notice", false);
		};
	})();

	game.request = function(path, properties, callback) {
		return channel.request("/game" + path, properties, callback);
	};
	game.removeApplicant = function(applicantUserID) {
		if(!game.applicantByUserID.hasOwnProperty(applicantUserID)) return;
		delete game.applicantByUserID[applicantUserID];
		if(applicantUserID == user.info.userID) {
			userIsApplicant = false;
			game.update();
		}
	};
	game.update = function() {
		if(channel.userIsMember) {
			game.action.value = "Broadcast Invitation";
			game.cancel.value = "Cancel Broadcast…";
			game.action.onclick = function() {
				game.request("/broadcast/");
			};
			game.cancel.onclick = function() {
				DOM.button.confirm(this, function() {
					game.request("/broadcast/stop/");
				});
			};

			var canBroadcast = game.info.playersNeeded > 0 && (game.broadcasting || !user.broadcastCount);
			DOM.changeClass(game.action, "notice", canBroadcast && game.broadcasting != channel.userIsMember);
			DOM.input.enable(game.action, canBroadcast);
			DOM.input.enable(game.cancel, game.broadcasting);
		} else {
			game.action.value = "Ask to Join";
			game.cancel.value = "Cancel Joining";
			game.action.onclick = function() {
				user.request("/broadcastChannel/application/", {channelID: channel.info.channelID});
			};
			game.cancel.onclick = function() {
				user.request("/broadcastChannel/application/stop/", {channelID: channel.info.channelID});
			};

			DOM.changeClass(game.action, "notice", !userIsApplicant);
			DOM.input.enable(game.action, true);
			DOM.input.enable(game.cancel, userIsApplicant);
		}
		DOM.input.enable(game.matchType.parentNode, game.rule.parentNode, game.playersNeeded.parentNode, channel.userIsMember);
		game.groups.applicants.update();
		game.updateTitle();
	};
	game.updateConfig = function() {
		var i;
		DOM.fill(game.matchType);
		if(user.config.matchTypes) bt.map(user.config.matchTypes, function(matchTypeInfo, index) {
			game.matchType.appendChild(DOM.select.option(matchTypeInfo.label, index));
		});
		DOM.fill(game.rule);
		if(user.config.rules) bt.map(user.config.rules, function(ruleInfo, index) {
			game.rule.appendChild(DOM.select.option(ruleInfo.label, index));
		});
		game.updateSettings();
	};
	game.updateSettings = function(body) {
		if(body) bt.map(["matchTypeID", "ruleID", "playersNeeded"], function(prop) {
			if(body.hasOwnProperty(prop)) game.info[prop] = body[prop];
		});

		DOM.fill(game.playersNeeded);
		for(i = 0; i < user.config.matchTypes[game.info.matchTypeID].playerCount; ++i) {
			game.playersNeeded.appendChild(DOM.select.option(""+i+" more needed", i));
		}

		DOM.select.choose(game.matchType.parentNode, game.info.matchTypeID);
		DOM.select.choose(game.rule.parentNode, game.info.ruleID);
		DOM.select.choose(game.playersNeeded.parentNode, game.info.playersNeeded);

		if(!user.config.matchTypes[game.info.matchTypeID].hasTeams) bt.map(channel.groups.members.itemByUserID, function(item) {
			item.setTeamID();
		});
		channel.groups.members.update();
		game.update();
	};
	game.updateTitle = function() {
		var memberNames = [];
		bt.map(channel.memberByUserID, function(member) {
			memberNames.push(member.info.userName);
		});
		memberNames.sort();
		var labels = [
			user.config.matchTypes[game.info.matchTypeID].label,
			memberNames.join(", "),
			user.config.rules[game.info.ruleID].label
		];
		if(game.info.playersNeeded) labels.push(""+game.info.playersNeeded+" more needed");
		channel.title = labels.join(" / ") || "(game channel)";
		if(channel.parent) Channel.updateSubchannels(channel.parent);
		DOM.fill(channel.sidebarItem.title, channel.title);
		if(announcement) DOM.scroll.preserve(channel.scrollBox, function() {
			DOM.fill(announcementElems.title, channel.title);
		});
	};

	game.event = bt.dispatch(null, null, null, 1);
	game.event.broadcast = bt.dispatch(function(body) {
		if(game.broadcasting) return;
		setBroadcasting(true);

		if(body.time) channel.postNotification("Broadcasting was started by "+channel.memberByUserID[body.broadcasterUserID].info.userName, new Date(body.time));
		announcement = DOM.clone("announcement", announcementElems);
		announcementElems.details.onclick = function() {
			channel.sidebarItem.select(true);
		};
		announcementElems.hide.onclick = function() {
			DOM.remove(announcement);
		};
		DOM.fill(announcementElems.title, channel.title);
		DOM.scroll.preserve(channel.parent.scrollBox, function() {
			channel.parent.announcements.appendChild(announcement);
		});

		updateIsBroadcasting();
	}, function(func, body) {
		if(!game.broadcasting) throw "Broadcast channel event sent to non-broadcasting channel";
		return func(body);
	});
	game.event.broadcast.stop = bt.dispatch(function(body) {
		setBroadcasting(false);
		DOM.remove(announcement);
		announcementElems = {};
		if(channel.removeIfNecessary()) return;
		game.applicantByUserID = {};
		userIsApplicant = false;
		game.groups.applicants.moveAllToGroup(channel.groups.nonMembers);

		if(body.stoppedUserID) channel.postNotification("Broadcasting was stopped by "+channel.memberByUserID[body.stoppedUserID].info.userName, new Date(body.time));
		else channel.postNotification("Broadcasting was stopped automatically", new Date(body.time));

		updateIsBroadcasting();
	});

	game.event.broadcast.application = bt.dispatch(function(body) {
		var applicantUserID = body.applicantUserID, applicant;
		if(game.applicantByUserID.hasOwnProperty(applicantUserID)) return;
		if(!user.personByUserID.hasOwnProperty(applicantUserID)) throw "Invalid applicant ID";
		applicant = user.personByUserID[applicantUserID];
		game.applicantByUserID[applicantUserID] = applicant;
		game.groups.applicants.addItem(channel.groups.nonMembers.removeItem(applicantUserID) || channel.groups.formerMembers.removeItem(applicantUserID), true);
		if(body.time) {
			if(channel.userIsMember) channel.incoming("challenge");
			channel.postNotification(applicant.info.userName+" wants to join", new Date(body.time));
		}
		if(applicantUserID === user.info.userID) {
			userIsApplicant = true;
			game.update();
		}
	});
	game.event.broadcast.application.stop = bt.dispatch(function(body) {
		var applicantUserID = body.applicantUserID, applicantName;
		if(!game.applicantByUserID.hasOwnProperty(applicantUserID)) throw "Specified person is not an applicant";
		channel.groups.nonMembers.addItem(game.groups.applicants.removeItem(applicantUserID), true);
		if(body.time) {
			applicantName = game.applicantByUserID[applicantUserID].info.userName;
			if(body.denierUserID) channel.postNotification(applicantName+" was denied by "+channel.memberByUserID[body.denierUserID].info.userName, new Date(body.time));
			else channel.postNotification(applicantName+" stopped trying to join", new Date(body.time));
		}
		game.removeApplicant(applicantUserID);
	});

	DOM.changeClass(channel.element, "game");
	channel.groups.members.setShowsBrawlInfo(true);
	channel.groups.formerMembers.setShowsBrawlInfo(true);
	game.element = DOM.clone("game", game);

	game.matchType.parentNode.onchange = function() {
		game.info.matchTypeID = this.options[this.selectedIndex].value;
		game.updateSettings();
		game.request("/settings/", {channelID: channel.info.channelID, matchTypeID: game.info.matchTypeID});
	};
	game.rule.parentNode.onchange = function() {
		game.info.ruleID = this.options[this.selectedIndex].value;
		game.updateSettings();
		game.request("/settings/", {channelID: channel.info.channelID, ruleID: game.info.ruleID});
	};
	game.playersNeeded.parentNode.onchange = function() {
		game.info.playersNeeded = this.options[this.selectedIndex].value;
		game.updateSettings();
		game.request("/settings/", {channelID: channel.info.channelID, playersNeeded: game.info.playersNeeded});
	};

	game.updateConfig();
	updateIsBroadcasting();
};
