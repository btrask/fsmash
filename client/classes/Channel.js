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

/*globals DOM: false, SidebarItem: false, bt: false, brawl: false, Group: false, Game: false */
var Channel = function(session, user, channelID, parentID) {
	var channel = this;

	var memberCount = 0;
	var chnlElems = {}, infoElems = {}, chatElems = {};
	var infoPane = DOM.clone("info", infoElems), chatPane = DOM.clone("chat", chatElems);

	var updateUserIsMember = function() {
		var flag = channel.memberByUserID.hasOwnProperty(user.info.userID);
		if(flag !== channel.userIsMember) {
			channel.userIsMember = flag;
			if(channel.game && channel.game.broadcasting) user.setBroadcasting(channel.userIsMember);
			if(channel.removeIfNecessary()) return;
			chnlElems.info.onclick();
		}
		DOM.input.enable(chnlElems.leave, chnlElems.chat, channel.userIsMember);
		channel.groups.members.update();
		channel.groups.formerMembers.update();
		channel.groups.nonMembers.update();
		if(channel.game) channel.game.update();
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
				return user.administrator && item.person !== user.person;
			}
			DOM.button.confirm(this, function() {
				user.administrator.request("/ban/", {personUserID: item.person.info.userID});
			});
		};
		var rateAction = function(validate, item) {
			var button = this;
			if(validate) {
				this.value = "Rate…";
				DOM.classify(button, "notice", false);
				if(!channel.game) return false;
				if(!channel.userIsMember) return false;
				if(item.person === user.person) return false;
				DOM.classify(button, "notice", !item.person.rated);
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
					DOM.classify(button, "notice", false);
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
			var ignoreButton = this;
			if(validate) {
				ignoreButton.value = (item.person.ignored ? "Unignore" : "Ignore");
				return channel.userIsMember && item.person !== user.person;
			}
			var setIgnored = function(flag) {
				DOM.input.enable(ignoreButton, false);
				user.request("/person/ignore/", {personUserID: item.person.info.userID, ignore: flag}, function() {
					DOM.input.enable(ignoreButton, true);
					item.group.update();
				});
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
				this.value = "Add";
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

	DOM.fill(infoElems.groups, channel.groups.members.element, channel.groups.formerMembers.element, channel.groups.nonMembers.element);

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
		memberCount--;

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
	channel.setModerator = function(flag) {
		if(channel.isModerator === flag) return;
		channel.isModerator = Boolean(flag);
		DOM.classify(channel.element, "moderator", Boolean(flag));
		DOM.classify(channel.element, "notModerator", !flag);
		bt.map(channel.channelByID, function(subchannel) {
			subchannel.setModerator(flag);
		});
	};

	channel.event = bt.dispatch();
	channel.event.member = bt.dispatch(function(body) {
		var memberUserID = body.memberUserID;
		var member, item, invitingPerson;
		if(!user.personByUserID.hasOwnProperty(memberUserID)) throw new Error("Invalid person joining the channel");
		if(channel.parent && !channel.parent.memberByUserID.hasOwnProperty(memberUserID)) throw new Error("Joining person not a member of parent channel");
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
			memberCount++;
		}
		if(!item) item = channel.groups.members.itemByUserID[memberUserID];
		if(undefined !== body.teamID) item.setTeamID(body.teamID);
		if(channel.userIsMember && body.time) {
			channel.alert("join");
			if(user.personByUserID.hasOwnProperty(body.invitingUserID)) invitingPerson = user.personByUserID[body.invitingUserID];
			if(invitingPerson) channel.postNotification(member.info.userName+" was added by "+invitingPerson.info.userName, new Date(body.time));
			else channel.postNotification(member.info.userName+" joined", new Date(body.time));
		}
	}, function(func, body) {
		if(!channel.memberByUserID.hasOwnProperty(body.memberUserID)) throw new Error("Invalid memberUserID");
		return func(body, channel.memberByUserID[body.memberUserID]);
	});
	channel.event.member.leave = bt.dispatch(function(body, member) {
		if(member !== user.person && channel.userIsMember && body.time) channel.alert("leave");
		channel.removeMember(member, body.time);
	});
	(function messaging() {
		var censorHistory = [];
		var incomingMessage = function(info) {
			if(!channel.userIsMember) throw new Error("Non-members should not be able to receive messages");
			var msgElems = {};
			var elem = DOM.clone("message", msgElems);
			var date = new Date(info.time);
			DOM.fill(msgElems.date, date.toLocaleTimeString());
			msgElems.date.title = date.toLocaleDateString();
			DOM.fill(msgElems.name, info.userName);
			DOM.fill(msgElems.text, DOM.inputify(info.text));
			user.getPerson(info.userID, info.userName).trackMessageElement(elem, msgElems.name);
			(function censoring() {
				var censored = false;
				var censor = function(censorText, replacementText) {
					if(!censorText || !replacementText) return;
					if(censorText !== info.text) return;
					DOM.fill(msgElems.text, DOM.inputify(replacementText));
					DOM.classify(msgElems.text, "censored");
					censored = true;
				};
				censorHistory.push(censor);
				while(censorHistory.length > 50) censorHistory.shift(); // FIXME: We should somehow get this number from the server config.
				if(info.censored) {
					DOM.classify(msgElems.text, "censored");
					censored = true;
				}
				msgElems.censor.onclick = function() {
					if(censored) return;
					if(!channel.isModerator) throw new Error("Moderator-only action");
					user.request("/channel/moderator/censor", {channelID: channel.info.channelID, censorText: info.text, replacementText: "Message removed by moderator"});
				};
			})();
			return elem;
		};
		channel.event.message = bt.dispatch(function(body) {
			if(!user.personByUserID.hasOwnProperty(body.userID)) return;
			var incoming = body.userID !== user.person.info.userID;
			if(incoming) channel.alert("message");
			DOM.scroll.preserve(channel.scrollBox, function() {
				var msgElement = incomingMessage(body);
				if(!incoming) DOM.classify(msgElement, "light");
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
		channel.event.censor = bt.dispatch(function(body) {
			bt.map(censorHistory, function(censor) {
				censor(body.censorText, body.replacementText);
			});
		});
	})();
	channel.event.game = bt.dispatch(function(body) {
		if(!channel.game) {
			channel.game = new Game(session, user, channel);
			infoElems.panels.insertBefore(channel.game.element, infoElems.panels.firstChild);
			infoElems.groups.insertBefore(channel.game.groups.applicants.element, infoElems.groups.firstChild);
			DOM.input.enable(chnlElems.newGame, chnlElems.newDiscussion, false);
		}
		channel.game.updateSettings(body);
	}, null, function(body) {
		if(!channel.game) throw new Error("Specified channel is not a game channel");
		return channel.game.event;
	});
	channel.event.moderator = bt.dispatch(function(body) {
		channel.setModerator(true);
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
		channel.alert = function(type) {
			if("challenge" === type || channel.game || channel.sidebarItem.selected || (channel.userIsMember && memberCount <= 2)) user.playSound(type);
			if(!pane.hasOwnProperty(type)) return;
			if(channel.sidebarItem.selected && pane[type].parentNode) return;
			if(!count.hasOwnProperty(type)) return;
			count[type]++;
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
		channel.setModerator(channel.parent.isModerator);
	} else {
		user.rootChannelByID[channelID] = channel;
		DOM.classify(channel.groups.nonMembers.element, "invisible");
		DOM.classify(channel.groups.formerMembers.element, "invisible");
		channel.setModerator(false);
	}

	chnlElems.info.onclick = function() {
		DOM.classify(chnlElems.chat, "selected", false);
		DOM.classify(chnlElems.info, "selected", true);
		DOM.fill(chnlElems.content, infoPane);
		channel.resetUnreadCounter("challenge");
	};
	chnlElems.chat.onclick = function() {
		DOM.classify(chnlElems.info, "selected", false);
		DOM.classify(chnlElems.chat, "selected", true);
		DOM.fill(chnlElems.content, chatPane);
		channel.resetUnreadCounter("message");
		DOM.scroll.toBottom(channel.scrollBox);
		focusMessageInput();
	};
	chnlElems.info.onclick();

	(function() {
		var sendMessage = function() {
			if(!channel.userIsMember) throw new Error("Non-members should not be able to send messages");
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
				// TODO: person.stopTrackingMessages() for every person. We have to do this even if the person left the channel because they might still have messages in it.
			});
		};
	})();

	(function() {
		var spawnSubchannel = function(topic) {
			if(!channel.userIsMember) throw new Error("Non-members should not be able to spawn subchannels");
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

	infoElems.empty.onclick = function() {
		DOM.button.confirm(this, function() {
			user.administrator.request("/channel/empty/", {channelID: channel.info.channelID});
		});
	};

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
	for(var i = 0; i < channels.length; ++i) element.appendChild(channels[i].sidebarItem.element);
};
