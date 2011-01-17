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
var Group = function() {
	var group = this;
	group.objects = [];
	group.sendEvent = function(path, event, ticket, ignoreObjects) {
		group.objects.map(function(object) {
			if(ignoreObjects && -1 !== ignoreObjects.indexOf(object)) return;
			object.sendEvent(path, event, ticket);
		});
	};
};
Group.sessions = new Group();
Group.users = new Group();
Group.administrators = new Group();

module.exports = Group;
