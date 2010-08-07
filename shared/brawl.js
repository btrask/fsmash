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
var brawl;
try { brawl = exports; } catch(e) { brawl = {}; }

brawl.brawlName = function(name) {
	return name.slice(0, 5);
};
brawl.friendCode = function(code, separator) {
	if(!code) return "";
	var blank = "000000000000";
	var fc = (blank + code).replace(/\D/g, "").slice(-12);
	if(blank === fc) return "";
	if(undefined === separator) separator = "-";
	return [fc.slice(0, 4), fc.slice(4, 8), fc.slice(8)].join(separator);
};
brawl.teams = {};
brawl.teams.colors = ["teamNone", "teamRed", "teamBlue", "teamGreen"];
