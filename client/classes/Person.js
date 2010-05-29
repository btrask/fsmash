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
var Person = function(session, user, userID) {
	var person = this;

	var stringForComponent = function(component) {
		if(!Person.keysByComponent.hasOwnProperty(component)) throw "Invalid component name";
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
		for(var component in Person.keysByComponent) if(Person.keysByComponent.hasOwnProperty(component)) DOM.fill(item[component], DOM.linkify(stringForComponent(component)));
	};

	var nameElements = [];

	person.info = {userID: userID};
	user.personByUserID[person.info.userID] = person;
	person.ignored = false;
	person.rated = false;
	person.online = false;

	person.event = bt.dispatch();
	person.event.signout = bt.dispatch(function(body) {
		bt.map(user.channelByID, function(channel) {
			channel.removeMember(person);
		});
		person.setOnline(false);
		if(person === user.person) session.terminate();
	});

	person.item = function() {
		return new PersonItem();
	};
	person.updateWithInfo = function(info) {
		var i;
		if(undefined !== info.friendCode) info.friendCode = brawl.friendCode(info.friendCode);
		if(undefined !== info.idle) {
			person.info.idle = !!info.idle;
			for(i = 0; i < allItems.length; ++i) DOM.changeClass(allItems[i].element, "idle", person.info.idle);
		}
		if(undefined !== info.rank) info.rank = "Rank "+info.rank;

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
				for(i = 0; i < allItems.length; ++i) DOM.fill(allItems[i][component], DOM.linkify(string));
			}
		}
	};
	person.setOnline = function(flag) {
		if(flag == person.online) return;
		person.online = !!flag;
		bt.map(nameElements, function(elem) {
			DOM.changeClass(elem, "online", person.online);
		});
	};
	person.nameElement = function() {
		var elem = document.createElement("span");
		DOM.fill(elem, person.info.userName);
		DOM.changeClass(elem, "name");
		if(person.online) DOM.changeClass(elem, "online");
		nameElements.push(elem);
		return elem;
	};
};
Person.keysByComponent = {
	title: ["userName", "location", "rank"],
	brawlInfoContent: ["brawlName", "friendCode"],
	bio: ["bio"]
};
