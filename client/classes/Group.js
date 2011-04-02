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
var Group = function(title, actions) {
	var group = this;
	group.itemByUserID = {};
	group.onadd = null;
	group.onremove = null;
	group.showsBrawlInfo = false;
	group.element = DOM.clone("group", group);
	DOM.fill(group.title, title);
	group.update = function() {
		var items = [];
		for(var id in group.itemByUserID) if(group.itemByUserID.hasOwnProperty(id)) items.push(group.itemByUserID[id]);
		items.sort(function(a, b) {
			return (a.person.info.userName || "").localeCompare(b.person.info.userName || "");
		});
		DOM.fill(group.children);
		for(var i = 0; i < items.length; ++i) {
			bt.map(actions, function(action, index) {
				var button = items[i].buttons[index];
				DOM.changeClass(button, "invisible", !action.call(button, true, items[i]));
			});
			group.children.appendChild(items[i].element);
		}
	};
	group.addItem = function(item, update) {
		var generateCommands = function() {
			var button, i;
			DOM.fill(item.commands);
			item.buttons = bt.map(actions, function(action) {
				button = DOM.clone("button");
				button.onclick = bt.curry(action, false, item);
				item.commands.appendChild(button);
				return button;
			});
		};
		if(!item) return;
		var userID = item.person.info.userID;
		if(group.itemByUserID.hasOwnProperty(userID)) throw new Error("This group already has an item for the specified person");
		group.itemByUserID[userID] = item;
		item.group = group;
		generateCommands();
		DOM.changeClass(item.brawlInfo, "invisible", !group.showsBrawlInfo);
		if(group.onadd) group.onadd(item);
		if(update) group.update();
	};
	group.removeItem = function(userID, destruct) {
		if(!group.itemByUserID.hasOwnProperty(userID)) return null;
		var item = group.itemByUserID[userID];
		delete group.itemByUserID[userID];
		delete item.group;
		if(destruct) item.destruct();
		else {
			DOM.remove(item.element);
			if(group.onremove) group.onremove(item);
			return item;
		}
	};
	group.setShowsBrawlInfo = function(flag) {
		group.showsBrawlInfo = flag;
		bt.map(group.itemByUserID, function(item) {
			DOM.changeClass(item.brawlInfo, "invisible", !group.showsBrawlInfo);
		});
	};
	group.moveAllToGroup = function(otherGroup) {
		bt.map(group.itemByUserID, function(item, userID) {
			otherGroup.addItem(group.removeItem(userID));
		});
		otherGroup.update();
	};
};
