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
var Channel = function(session, user, channelID, parentID) {
	var channel = this;

	var chnlElems = {}, chatElems = {};
	var infoPane = DOM.clone("info"), chatPane = DOM.clone("chat", chatElems);

	var updateUserIsMember = function() {
		var flag = channel.memberByUserID.hasOwnProperty(user.info.userID);
		if(flag !== channel.userIsMember) {
			channel.userIsMember = flag;
			if(channel.game && channel.game.broadcasting) user.setBroadcasting(channel.userIsMember);
			chnlElems.info.onclick();
			if(channel.removeIfNecessary()) return;
		}
		DOM.input.enable(chnlElems.leave, chnlElems.chat, channel.userIsMember);
		channel.groups.members.update();
		channel.groups.formerMembers.update();
		channel.groups.nonMembers.update();
		if(channel.game) channel.game.update();
	};
	var incomingMessage = function(info) {
		if(!channel.userIsMember) throw "Non-members should not be able to receive messages";
		var msgElems = {};
		var elem = DOM.clone("message", msgElems);
		DOM.fill(msgElems.date, new Date(info.time).toLocaleTimeString());
		DOM.fill(msgElems.name, user.getPerson(info.userID, info.userName).nameElement());
		DOM.fill(msgElems.text, DOM.inputify(info.text));
		return elem;
	};
	var focusMessageInput = function() {
		DOM.field.focus(chatElems.input);
	};

	channel.info = {channelID: channelID, parentID: parentID};
	channel.memberByUserID = {};
	channel.channelByID = {};
	channel.userIsMember = false;

	channel.element = DOM.clone("channel", chnlElems);
	channel.scrollBox = chatElems.scrollBox;
	channel.announcements = chatElems.announcements;
	channel.sidebarItem = new SidebarItem("(untitled)");
	channel.sidebarItem.setContent(channel.element);
	channel.sidebarItem.onshow = function() {
		channel.groups.members.update();
		channel.groups.formerMembers.update();
		if(infoPane.parentNode) {
			channel.resetUnreadCounter("challenge");
		}
		if(chatPane.parentNode) {
			channel.resetUnreadCounter("message");
			DOM.scroll.toBottom(channel.scrollBox);
			focusMessageInput();
		}
	};

	(function() {
		var banAction = function(validate, item) {
			if(validate) {
				this.value = "Ban…";
				return user.admin && item.person !== user.person;
			}
			DOM.button.confirm(this, function() {
				user.admin.request("/ban/", {personUserID: item.person.info.userID});
			});
		};
		var rateAction = function(validate, item) {
			var button = this;
			if(validate) {
				this.value = "Rate…";
				DOM.changeClass(button, "notice", false);
				if(!channel.game) return false;
				if(!channel.userIsMember) return false;
				if(item.person === user.person) return false;
				DOM.changeClass(button, "notice", !item.person.rated);
				return true;
			}
			var elems = {};
			var ratePanel = DOM.clone("rating", elems);
			var rate = function(rating) {
				DOM.input.enable(elems.down, elems.neutral, elems.up, false);
				user.request("/person/rate/", {personUserID: item.person.info.userID, rating: rating}, function(result) {
					DOM.input.enable(elems.down, elems.neutral, elems.up, true);
					if(!result) return;
					item.person.rated = true;
					DOM.changeClass(button, "notice", false);
					DOM.remove(ratePanel);
				});
			};
			DOM.fill(elems.title, "vs. "+item.person.info.userName);
			elems.up.onclick = bt.curry(rate, 1);
			elems.neutral.onclick = bt.curry(rate, 0);
			elems.down.onclick = bt.curry(rate, -1);
			elems.cancel.onclick = function() {
				DOM.remove(ratePanel);
			};
			session.showModal(ratePanel);
		};
		var ignoreAction = function(validate, item) {
			if(validate) {
				this.value = (item.person.ignored ? "Unignore" : "Ignore");
				return channel.userIsMember && item.person !== user.person;
			}
			var setIgnored = function(flag) {
				item.person.ignored = flag;
				user.request("/person/block/", {personUserID: item.person.info.userID, block: flag});
				item.group.update();
			};
			setIgnored(!item.person.ignored);
		};
		var teamAction = function(validate, item) {
			if(validate) {
				this.value = "Team";
				if(!channel.userIsMember || !channel.game) return false;
				return user.config.matchTypes[channel.game.info.matchTypeID].hasTeams;
			}
			channel.game.request("/member/team/", {memberUserID: item.person.info.userID, teamID: (item.teamID + 1) % brawl.teams.colors.length});
		};
		var inviteAction = function(validate, item) {
			if(validate) {
				this.value = "Invite";
				return channel.userIsMember && item.person !== user.person;
			}
			channel.request("/invite/", {invitedUserID: item.person.info.userID});
		};

		channel.groups = {
			members: new Group("Members", [banAction, ignoreAction, rateAction, teamAction]),
			formerMembers: new Group("Former Members", [banAction, rateAction]),
			nonMembers: new Group("Non-Members", [banAction, inviteAction])
		};
		channel.groups.members.onremove = function(item) {
			item.setTeamID();
		};
	})();

	DOM.fill(infoPane, channel.groups.members.element, channel.groups.formerMembers.element, channel.groups.nonMembers.element);

	channel.request = function(path, properties, callback) {
		return user.request("/channel" + path, bt.union(properties, {channelID: channel.info.channelID}), callback);
	};
	channel.personJoinedParentChannel = function(person) {
		if(!channel.groups.formerMembers.itemByUserID.hasOwnProperty(person.info.userID)) channel.groups.nonMembers.addItem(person.item(), true);
	};
	channel.personLeftParentChannel = function(person) {
		var userID = person.info.userID;
		channel.groups.nonMembers.removeItem(userID, true);
		if(channel.game) channel.game.groups.applicants.removeItem(userID, true);
		channel.groups.formerMembers.addItem(channel.groups.members.removeItem(userID), true);
	};
	channel.removeMember = function(member, time) {
		if(!channel.memberByUserID.hasOwnProperty(member.info.userID)) return;
		channel.groups.formerMembers.addItem(channel.groups.members.removeItem(member.info.userID), true);
		bt.map(channel.channelByID, function(channel) {
			channel.personLeftParentChannel(member);
		});

		delete channel.memberByUserID[member.info.userID];
		updateUserIsMember();

		if(channel.userIsMember && time) channel.postNotification(member.info.userName+" left", new Date(time));
	};
	channel.removeIfNecessary = function() {
		if(channel.userIsMember) return false;
		if(channel.game && channel.game.broadcasting) return false;
		channel.sidebarItem.select(false);
		DOM.remove(channel.sidebarItem.element);
		(function removeRecursively(c) {
			for(var id in c.channelByID) if(c.channelByID.hasOwnProperty(id)) arguments.callee(c.channelByID[id]);
			if(c.parent) delete c.parent.channelByID[c.info.channelID];
			delete user.channelByID[c.info.channelID];
			delete user.rootChannelByID[c.info.channelID];
		})(channel);
		return true;
	};
	channel.postNotification = function(message, date) {
		if(!channel.userIsMember) return;
		var notifElems = {};
		var elem = DOM.clone("notification", notifElems);
		DOM.fill(notifElems.message, message);
		DOM.fill(notifElems.date, date.toLocaleTimeString());
		DOM.scroll.preserve(channel.scrollBox, function() {
			chatElems.messages.appendChild(elem);
		});
	};
	channel.setAllowsGameChannels = function(flag) {
		DOM.input.enable(chnlElems.newGame, flag && !channel.game);
	};

	channel.event = bt.dispatch();
	channel.event.member = bt.dispatch(function(body) {
		var memberUserID = body.memberUserID;
		var member, item, invitingPerson;
		if(!user.personByUserID.hasOwnProperty(memberUserID)) throw "Invalid person joining the channel";
		if(channel.parent && !channel.parent.memberByUserID.hasOwnProperty(memberUserID)) throw "Joining person not a member of parent channel";
		member = user.personByUserID[memberUserID];
		if(!channel.memberByUserID.hasOwnProperty(memberUserID)) {
			item = channel.groups.nonMembers.removeItem(memberUserID) || channel.groups.formerMembers.removeItem(memberUserID);
			if(channel.game) {
				if(!item) item = channel.game.groups.applicants.removeItem(memberUserID);
				channel.game.removeApplicant(memberUserID);
			}
			if(!item) item = member.item();
			channel.groups.members.addItem(item, true);
			bt.map(channel.channelByID, function(channel) {
				channel.personJoinedParentChannel(member);
			});

			channel.memberByUserID[memberUserID] = member;
			updateUserIsMember();
		}
		if(!item) item = channel.groups.members.itemByUserID[memberUserID];
		if(undefined !== body.teamID) item.setTeamID(body.teamID);
		if(channel.userIsMember && body.time) {
			user.playSound("join");
			if(user.personByUserID.hasOwnProperty(body.invitingUserID)) invitingPerson = user.personByUserID[body.invitingUserID];
			if(invitingPerson) channel.postNotification(member.info.userName+" was invited by "+invitingPerson.info.userName, new Date(body.time));
			else channel.postNotification(member.info.userName+" joined", new Date(body.time));
		}
	}, function(func, body) {
		if(!channel.memberByUserID.hasOwnProperty(body.memberUserID)) throw "Invalid memberUserID";
		return func(body, channel.memberByUserID[body.memberUserID]);
	});
	channel.event.member.leave = bt.dispatch(function(body, member) {
		if(member !== user.person && body.time) user.playSound("leave");
		channel.removeMember(member, body.time);
	});
	channel.event.message = bt.dispatch(function(body) {
		if(!user.personByUserID.hasOwnProperty(body.userID)) return;
		if(user.personByUserID[body.userID].ignored) return;
		var incoming = body.userID != user.person.info.userID;
		if(incoming) channel.incoming("message");
		DOM.scroll.preserve(channel.scrollBox, function() {
			var msgElement = incomingMessage(body);
			if(!incoming) DOM.changeClass(msgElement, "light");
			chatElems.messages.appendChild(msgElement);
		});
	});
	channel.event.history = bt.dispatch(function(body) {
		if(!body.history || !body.history.length) return;
		var history = DOM.clone("history"), i;
		bt.map(body.history, function(info) {
			history.appendChild(incomingMessage(info));
		});
		DOM.scroll.preserve(channel.scrollBox, function() {
			DOM.fill(chatElems.messages, history);
		});
	});
	channel.event.game = bt.dispatch(function(body) {
		if(!channel.game) {
			channel.game = new Game(session, user, channel);
			infoPane.insertBefore(channel.game.groups.applicants.element, infoPane.firstChild);
			infoPane.insertBefore(channel.game.element, infoPane.firstChild);
			DOM.input.enable(chnlElems.newGame, chnlElems.newDiscussion, false);
		}
		channel.game.updateSettings(body);
	}, null, function(body) {
		if(!channel.game) throw "Specified channel is not a game channel";
		return channel.game.event;
	});

	(function unreadCounts() {
		var count = {
			challenge: 0,
			message: 0
		};
		var pane = {
			challenge: infoPane,
			message: chatPane
		};
		var updateCounter = function() {
			var counter;
			if(count.challenge) {
				counter = [count.challenge, count.message].join("+");
			} else if(count.message) {
				counter = count.message;
			}
			DOM.fill(channel.sidebarItem.counter, counter);
		};
		channel.incoming = function(type) {
			if("message" != type || channel.game || channel.sidebarItem.selected) user.playSound(type);
			if(!pane.hasOwnProperty(type)) return;
			if(channel.sidebarItem.selected && pane[type].parentNode) return;
			if(count.hasOwnProperty(type)) count[type]++;
			updateCounter();
		};
		channel.resetUnreadCounter = function(type) {
			if(!count.hasOwnProperty(type)) return;
			count[type] = 0;
			updateCounter();
		};
	})();

	user.channelByID[channel.info.channelID] = channel;
	channel.parent = user.channelByID[channel.info.parentID];
	if(channel.parent) {
		channel.parent.channelByID[channel.info.channelID] = channel;
		Channel.updateSubchannels(channel.parent);

		bt.map(channel.parent.memberByUserID, function(member) {
			channel.groups.nonMembers.addItem(member.item());
		});
		channel.groups.nonMembers.update();
	} else {
		user.rootChannelByID[channelID] = channel;
		DOM.changeClass(channel.groups.nonMembers.element, "invisible");
		DOM.changeClass(channel.groups.formerMembers.element, "invisible");
	}

	chnlElems.info.onclick = function() {
		DOM.changeClass(chnlElems.chat, "selected", false);
		DOM.changeClass(chnlElems.info, "selected", true);
		DOM.fill(chnlElems.content, infoPane);
		channel.resetUnreadCounter("challenge");
	};
	chnlElems.chat.onclick = function() {
		DOM.changeClass(chnlElems.info, "selected", false);
		DOM.changeClass(chnlElems.chat, "selected", true);
		DOM.fill(chnlElems.content, chatPane);
		channel.resetUnreadCounter("message");
		DOM.scroll.toBottom(channel.scrollBox);
		focusMessageInput();
	};
	chnlElems.info.onclick();

	(function() {
		var sendMessage = function() {
			if(!channel.userIsMember) throw "Non-members should not be able to send messages";
			var text = chatElems.input.value.replace(/^\s*|\s*$/g, "");
			if(text) {
				chatElems.input.value = "";
				DOM.scroll.toBottom(channel.scrollBox);
				channel.request("/message/", {text: text});
			}
			DOM.field.focus(chatElems.input);
		};
		chatElems.send.onclick = sendMessage;
		chatElems.input.onkeypress = function(event) {
			if(DOM.event.isReturn(event)) sendMessage();
		};
		chatElems.clear.onclick = function() {
			DOM.button.confirm(this, function() {
				DOM.fill(chatElems.messages);
			});
		};
	})();

	(function() {
		var spawnSubchannel = function(topic) {
			if(!channel.userIsMember) throw "Non-members should not be able to spawn subchannels";
			channel.request("/spawn/", {topic: topic}, function(channel) {
				if(channel) channel.sidebarItem.select(true);
			});
		};
		chnlElems.newGame.onclick = bt.curry(spawnSubchannel, null);
		chnlElems.newDiscussion.onclick = function() {
			var elems = {};
			var discussionPanel = DOM.clone("discussion", elems);
			var sanitizeTopic = function(topic) {
				return topic.replace(/^\s*|\s\s+|\s*$/g, "");
			};
			var confirm = function() {
				var topic = sanitizeTopic(elems.topic.value);
				if(topic.length) spawnSubchannel(topic);
				DOM.remove(discussionPanel);
			};
			elems.topic.onkeypress = function(event) {
				if(DOM.event.isReturn(event)) return confirm();
			};
			elems.topic.onkeyup = function() {
				elems.confirm.value = (sanitizeTopic(this.value) ? "Create" : "Cancel");
			};
			elems.topic.onkeyup();
			elems.confirm.onclick = confirm;
			session.showModal(discussionPanel);
			DOM.field.focus(elems.topic);
		};
	})();

	chnlElems.leave.onclick = function() {
		DOM.button.confirm(this, function() {
			channel.request("/leave/");
		});
	};
	chatElems.report.onclick = function() {
		DOM.button.confirm(this, function() {
			channel.request("/report/");
		});
	};

	updateUserIsMember();
};
Channel.updateSubchannels = function(parentChannel, channelByID, element, compare) {
	var channels = [];
	if(!channelByID) channelByID = parentChannel.channelByID;
	if(!element) element = parentChannel.sidebarItem.children;
	if(!compare) compare = function(a, b) {
		return (a.title || "").localeCompare(b.title || "");
	};
	for(var id in channelByID) if(channelByID.hasOwnProperty(id)) channels.push(channelByID[id]);
	channels.sort(compare);
	DOM.fill(element);
	for(i = 0; i < channels.length; ++i) element.appendChild(channels[i].sidebarItem.element);
};
