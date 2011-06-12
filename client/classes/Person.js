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
var Person = function(session, user, userID) {
	var person = this;

	var stringForComponent = function(component) {
		if(!Person.keysByComponent.hasOwnProperty(component)) throw new Error("Invalid component name");
		var keys = Person.keysByComponent[component];
		var values = [];
		for(var i = 0; i < keys.length; i++) if(person.info.hasOwnProperty(keys[i]) && person.info[keys[i]]) values.push(person.info[keys[i]]);
		return values.join(" / ");
	};

	var allItems = [];
	var PersonItem = function() {
		var item = this;

		item.destruct = function() {
			var i = allItems.indexOf(item);
			if(-1 !== i) allItems.splice(i, 1);
			DOM.remove(item.element);
			delete item.element;
			delete item.destruct;
		};
		item.setTeamID = function(teamID) {
			if(!brawl.teams.colors.hasOwnProperty(teamID)) teamID = 0;
			DOM.changeClass(item.element, brawl.teams.colors[item.teamID], false);
			item.teamID = teamID;
			DOM.changeClass(item.element, brawl.teams.colors[item.teamID], true);
		};

		item.person = person;
		allItems.push(item);
		item.element = DOM.clone("person", item);
		DOM.changeClass(item.element, "idle", item.person.info.idle);
		item.setTeamID();
		for(var component in Person.keysByComponent) if(Person.keysByComponent.hasOwnProperty(component)) DOM.fill(item[component], DOM.inputify(stringForComponent(component)));
	};

	person.info = {
		userID: userID,
		friendCode: "(no friend code specified in profile)"
	};
	user.personByUserID[person.info.userID] = person;
	person.rated = false;
	person.offline = true;
	person.subscriber = false;
	person.ignored = false;
	person.color = null;

	person.event = bt.dispatch();
	person.event.signout = bt.dispatch(function(body) {
		bt.map(user.channelByID, function(channel) {
			channel.removeMember(person);
		});
		person.setOffline(true);
		if(person === user.person) session.terminate();
	});

	person.item = function() {
		return new PersonItem();
	};
	person.updateWithInfo = function(info) {
		var i;
		if(undefined !== info.friendCode) info.friendCode = brawl.friendCode(info.friendCode) || "(no friend code specified in profile)";
		if(undefined !== info.idle) {
			person.info.idle = Boolean(info.idle);
			for(i = 0; i < allItems.length; ++i) DOM.changeClass(allItems[i].element, "idle", person.info.idle);
		}
		if(undefined !== info.rank) info.rank = "Rank "+info.rank;
		if(undefined !== info.subscriber) {
			if(info.subscriber) info.memberType = "Subscriber";
			else delete info.memberType;
			person.setSubscriber(info.subscriber);
		}
		if(undefined !== info.color) {
			person.setColor(info.color ? "#"+info.color : "");
			if(person === user.person) user.setColor(info.color);
		}

		var keys, componentNeedsUpdate, string;
		for(var component in Person.keysByComponent) if(Person.keysByComponent.hasOwnProperty(component)) {
			keys = Person.keysByComponent[component];
			componentNeedsUpdate = false;
			for(i = 0; i < keys.length; ++i) if(info.hasOwnProperty(keys[i])) {
				person.info[keys[i]] = info[keys[i]];
				componentNeedsUpdate = true;
			}
			if(componentNeedsUpdate) {
				string = stringForComponent(component);
				for(i = 0; i < allItems.length; ++i) DOM.fill(allItems[i][component], DOM.inputify(string));
			}
		}
	};
	(function() {
		var elementsByChannelID = {};
		var applyToElements = function(func/* (elems) */) {
			bt.map(elementsByChannelID, function(array) {
				bt.map(array, func);
			});
		};
		var setProperty = function(prop, flag) {
			if(flag == person[prop]) return;
			person[prop] = Boolean(flag);
			applyToElements(function(elems) {
				DOM.changeClass(elems.element, prop, flag);
			});
		};
		person.trackMessageElement = function(elem, name, channelID) {
			if(!elementsByChannelID.hasOwnProperty(channelID)) elementsByChannelID[channelID] = [];
			elementsByChannelID[channelID].push({
				element: elem,
				name: name
			});
			DOM.changeClass(elem, "offline", person.offline);
			DOM.changeClass(elem, "subscriber", person.subscriber);
			DOM.changeClass(elem, "ignored", person.ignored);
			name.style.color = person.color;
		};
		person.stopTrackingMessages = function(channelID) {
			delete elementsByChannelID[channelID];
		};

		person.setOffline = bt.curry(setProperty, "offline");
		person.setSubscriber = bt.curry(setProperty, "subscriber");
		person.setIgnored = bt.curry(setProperty, "ignored");
		person.setColor = function(color) {
			person.color = color;
			applyToElements(function(elems) {
				elems.name.style.color = color;
			});
		};
	})();
};
Person.keysByComponent = {
	title: ["userName", "location", "rank", "memberType"],
	brawlInfoContent: ["brawlName", "friendCode"],
	bio: ["bio"]
};
