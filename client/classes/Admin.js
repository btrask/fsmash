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
var Admin = function(session, user, signupAllowed) {
	var admin = this;

	var adminItem;
	var adminElems = {};
	var unreadReports = 0;

	admin.event = bt.dispatch();
	admin.event.reports = bt.dispatch(function(reports) {
		adminElems.reports.insertBefore(DOM.toElement(bt.map(reports, function(report) {
			return "User: "+report.userName+"; Channel: "+(report.topic || "")+"; Time: "+new Date(report.time).toUTCString();
		}).join("\n")+"\n"), adminElems.reports.firstChild);
		if(adminItem.selected) return;
		unreadReports += reports.length;
		DOM.fill(adminItem.counter, unreadReports);
	});

	adminItem = new SidebarItem("Admin");
	adminItem.onshow = function() {
		unreadReports = 0;
		DOM.fill(adminItem.counter);
	};
	session.siteItem.children.appendChild(adminItem.element);
	adminItem.setContent(DOM.clone("admin", adminElems));

	adminElems.signupAllowed.value = "Signup allowed: "+signupAllowed;
	adminElems.signupAllowed.onclick = function() {
		user.request("/admin/signups/", {signupAllowed: !signupAllowed}, function(result) {
			if(!result) return;
			signupAllowed = result.signupAllowed;
			adminElems.signupAllowed.value = "Signup allowed: "+signupAllowed;
		});
	};

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
};
