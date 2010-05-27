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
"use strict";
var User = function(session, userID) {
	var user = this;

	var channelsItem = new SidebarItem("Channels");
	var acctElems = {};

	session.sidebar.appendChild(channelsItem.element);
	user.account = DOM.clone("account", acctElems);

	user.personByUserID = {};
	user.channelByID = {};
	user.rootChannelByID = {};
	user.config = {};
	user.person = new Person(session, user, userID);

	DOM.changeClass(session.videoSubmitPane, "invisible", false);

	user.event = bt.dispatch();
	user.event.config = bt.dispatch(function(body) {
		bt.mixin(user.config, body);
		if(user.config.publicChannels) {
			DOM.fill(acctElems.publicChannels);
			bt.map(user.config.publicChannels, function(channelInfo, index) {
				var elems = {};
				acctElems.publicChannels.appendChild(DOM.clone("publicChannel", elems));
				DOM.fill(elems.title, channelInfo.topic);
				elems.description.innerHTML = channelInfo.descriptionHTML;
				elems.join.onclick = function() {
					var showChannel = function() {
						if(!user.channelByID.hasOwnProperty(channelInfo.channelID)) return false;
						user.channelByID[channelInfo.channelID].sidebarItem.select(true);
						return true;
					};
					if(showChannel()) return;
					user.request("/publicChannel/join/", {channelID: channelInfo.channelID}, showChannel);
				};
			});
		}
		if(user.config.soundsets) {
			DOM.fill(acctElems.soundsets);
			bt.map(user.config.soundsets, function(soundset, index) {
				acctElems.soundsets.appendChild(DOM.select.option(soundset.label, soundset.soundsetID));
			});
		}
		if(user.config.matchTypes || user.config.rules) bt.map(user.channelByID, function(channel) {
			if(channel.game) channel.game.updateConfig();
		});
	});
	user.event.settings = bt.dispatch(function(body) {
		if(undefined !== body.styleID) user.setStyleID(body.styleID);
		if(undefined !== body.soundsetID) user.setSoundsetID(body.soundsetID);
	});
	user.event.person = bt.dispatch(function(body) {
		var person;
		if(user.personByUserID.hasOwnProperty(body.userID)) person = user.personByUserID[body.userID];
		else person = new Person(session, user, body.userID);
		person.updateWithInfo(body);
	}, null, function(body) {
		return user.personByUserID.hasOwnProperty(body.userID) ? user.personByUserID[body.userID].event : null;
	});
	user.event.channel = bt.dispatch(function(body) {
		var channel, channels;
		if(user.channelByID.hasOwnProperty(body.channelID)) channel = user.channelByID[body.channelID];
		else channel = new Channel(session, user, body.channelID, body.parentID);
		if(body.topic) {
			channel.title = body.topic;
			DOM.fill(channel.sidebarItem.title, channel.title);
			if(channel.parent) Channel.updateSubchannels(channel.parent);
			else Channel.updateSubchannels(null, user.rootChannelByID, channelsItem.children, function(a, b) {
				var getChannelID = function(channelInfo) { return channelInfo.channelID; };
				return bt.array.indexOf(user.config.publicChannels, a.info.channelID, getChannelID) - bt.array.indexOf(user.config.publicChannels, b.info.channelID, getChannelID);
			});
		}
		if(undefined !== body.allowsGameChannels) channel.setAllowsGameChannels(body.allowsGameChannels);
		return channel;
	}, null, function(body) {
		return user.channelByID.hasOwnProperty(body.channelID) ? user.channelByID[body.channelID].event : null;
	});

	user.request = function(path, properties, callback) {
		return session.request("/user" + path, properties, callback);
	};
	user.updateWithInfo = function() {
		acctElems.brawlName.value = user.info.brawlName || "";
		acctElems.friendCode.value = brawl.friendCode(user.info.friendCode);
		acctElems.bio.value = user.info.bio || "";
		DOM.field.placeholder(acctElems.brawlName, acctElems.friendCode, acctElems.bio);
	};

	acctElems.signout.onclick = function() {
		DOM.button.confirm(this, function() {
			session.request("/terminate/");
		});
	};
	(function profile() {
		var changeProfileField = function(name) {
			var obj = {};
			obj[name] = this.value;
			user.request("/profile/", obj);
			this.blur();
		};
		DOM.field.onChange(acctElems.brawlName, bt.curry(changeProfileField, "brawlName"));
		DOM.field.onChange(acctElems.friendCode, function() {
			this.value = brawl.friendCode(this.value);
			changeProfileField.call(this, "friendCode");
		});
		DOM.field.onChange(acctElems.bio, bt.curry(changeProfileField, "bio"));
	})();
	(function styles() {
		var links = document.getElementsByTagName("link"), i;
		var isCSSStyleElement = function(link) {
			return link.title && link.getAttribute("data-style-id");
		};
		var setStyleID = function(styleID) {
			for(var i = 0; i < links.length; ++i) if(isCSSStyleElement(links[i])) links[i].disabled = links[i].getAttribute("data-style-id") != styleID;
		};
		user.setStyleID = function(styleID) {
			setStyleID(styleID);
			DOM.select.choose(acctElems.styles.parentNode, styleID);
		};

		DOM.fill(acctElems.styles, DOM.select.option("Light", "1"));
		for(i = 0; i < links.length; ++i) if(isCSSStyleElement(links[i])) {
			links[i].disabled = true;
			acctElems.styles.appendChild(DOM.select.option(links[i].title, links[i].getAttribute("data-style-id")));
		}
		acctElems.styles.parentNode.onchange = function() {
			var styleID = this.options[this.selectedIndex].value;
			setStyleID(styleID);
			user.request("/settings/", {styleID: styleID});
		};
	})();
	(function soundsets() {
		var soundset;
		var setSoundsetID = function(soundsetID) {
			if(!user.config.soundsets) return;
			for(var i = 0; i < user.config.soundsets.length; ++i) {
				if(soundsetID != user.config.soundsets[i].soundsetID) continue;
				soundset = user.config.soundsets[i];
				break;
			}
		};
		user.setSoundsetID = function(soundsetID) {
			setSoundsetID(soundsetID);
			DOM.select.choose(acctElems.soundsets.parentNode, soundsetID);
		};
		user.playSound = function(name) {
			if(!soundset || !soundset.path || !soundset.hasOwnProperty(name)) return;
			var embed = document.createElement("embed");
			embed.setAttribute("width", 0);
			embed.setAttribute("height", 0);
			embed.setAttribute("hidden", true);
			embed.setAttribute("autostart", true);
			embed.setAttribute("volume", 50);
			embed.src = "soundsets/"+soundset.path+"/"+soundset[name]+".wav";
			DOM.fill(DOM.id("audio"), embed);
		};

		acctElems.soundsets.parentNode.onchange = function() {
			var soundsetID = this.options[this.selectedIndex].value;
			setSoundsetID(soundsetID);
			user.request("/settings/", {soundsetID: soundsetID});
		};
	})();
	(function idle() {
		var idleTimeout;
		user.resetIdleTimeout = function() {
			if(null === idleTimeout) user.request("/idle/", {idle: false});
			clearTimeout(idleTimeout);
			idleTimeout = setTimeout(function() {
				idleTimeout = null;
				user.request("/idle/", {idle: true});
			}, 1000 * 60 * 5);
		};
		user.resetIdleTimeout();
	})();
	(function admin() {
		var adminItem;
		var adminElems = {};
		var unreadReports = 0;
		user.event.admin = bt.dispatch(function(body) {
			adminItem = new SidebarItem("Admin");
			adminItem.onshow = function() {
				unreadReports = 0;
				DOM.fill(adminItem.counter);
			};
			session.siteItem.children.appendChild(adminItem.element);
			adminItem.setContent(DOM.clone("admin", adminElems));
			(function() {
				var signupAllowed = body.signupAllowed;
				adminElems.signupAllowed.value = "Signup allowed: "+signupAllowed;
				adminElems.signupAllowed.onclick = function() {
					user.request("/admin/signups/", {signupAllowed: !signupAllowed}, function(result) {
						if(!result) return;
						signupAllowed = result.signupAllowed;
						adminElems.signupAllowed.value = "Signup allowed: "+signupAllowed;
					});
				};
			})();
			adminElems.uncache.onclick = function() {
				user.request("/admin/uncache/");
			};
			adminElems.reconfigure.onclick = function() {
				user.request("/admin/reconfigure/");
			};
			adminElems.updateRankings.onclick = function() {
				user.request("/admin/rankings/");
			};
			adminElems.updateStatistics.onclick = function() {
				user.request("/admin/statistics/", {}, function(result) {
					var stats = [];
					bt.map(result, function(val, prop) {
						stats.push(prop+": "+val);
					});
					DOM.fill(adminElems.statistics, stats.join("\n"));
				});
			};
		});
		user.event.admin.reports = bt.dispatch(function(reports) {
			adminElems.reports.insertBefore(DOM.toElement(bt.map(reports, function(report) {
				return "User: "+report.userName+"; Channel: "+(report.topic || "")+"; Time: "+new Date(report.time).toUTCString();
			}).join("\n")+"\n"), adminElems.reports.firstChild);
			if(adminItem.selected) return;
			unreadReports += reports.length;
			DOM.fill(adminItem.counter, unreadReports);
		});
	})();
};
