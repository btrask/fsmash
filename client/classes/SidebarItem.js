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
var SidebarItem = function(title) {
	var item = this;
	item.selected = false;
	item.element = DOM.clone("sidebarItem", item);
	item.content = undefined;
	DOM.fill(item.title, title);
	item.select = function(flag) {
		if(flag == item.selected) return;
		if(flag) {
			if(SidebarItem.selected) SidebarItem.selected.select(false);
			SidebarItem.selected = item;
		}
		item.selected = Boolean(flag);
		DOM.changeClass(item.row, "selected", flag);
		DOM.fill(DOM.id("main"), (flag ? item.content : undefined));
		if(flag && item.onshow) item.onshow();
	};
	item.setContent = function(content) {
		item.content = content;
		if(item.selected) DOM.fill(DOM.id("main"), content);
	};
	item.row.onclick = function() {
		if(item.content && !item.selected) item.select(true);
	};
};
SidebarItem.deselect = function() {
	if(!SidebarItem.selected) return;
	SidebarItem.selected.select(false);
	delete SidebarItem.selected;
};
