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
var Administrator = function(session, user, signupAllowed) {
	var administrator = this;

	var administratorItem;
	var administratorElems = {};

	var bump = function() {
		if(!administratorItem.selected) DOM.fill(administratorItem.counter, "!");
	};

	administrator.event = bt.dispatch();
	administrator.event.reports = bt.dispatch(function(reports) {
		administratorElems.reports.insertBefore(DOM.toElement(bt.map(reports, function(report) {
			return (report.topic || "(untitled)") + " / " + report.userName + " / " + new Date(report.time).toUTCString();
		}).join("\n")+"\n"), administratorElems.reports.firstChild);
		bump();
	});
	administrator.event.censored = bt.dispatch(function(censoredMessages) {
		administratorElems.censored.insertBefore(DOM.toElement(bt.map(censoredMessages, function(censored) {
			return (censored.topic || "(untitled)") + " / " + censored.modUserName + " / " + new Date(censored.time).toUTCString() +
				"\n\t" + censored.censorText +
				"\n\t"+censored.replacementText;
		}).join("\n")+"\n"), administratorElems.censored.firstChild);
		bump();
	});

	administrator.request = function(path, properties, callback) {
		return user.request("/administrator" + path, properties, callback);
	};

	administratorItem = new SidebarItem("Administrator");
	administratorItem.onshow = function() {
		DOM.fill(administratorItem.counter);
	};
	session.siteItem.children.appendChild(administratorItem.element);
	administratorItem.setContent(DOM.clone("administrator", administratorElems));
	bump();

	administratorElems.signupAllowed.value = signupAllowed ? "Turn Signup Off" : "Turn Signup On";
	administratorElems.signupAllowed.onclick = function() {
		administrator.request("/signups/", {signupAllowed: !signupAllowed}, function(result) {
			if(!result) return;
			signupAllowed = result.signupAllowed;
			administratorElems.signupAllowed.value = signupAllowed ? "Turn Signup Off" : "Turn Signup On";
		});
	};

	administratorElems.updateFiles.onclick = function() {
		administrator.request("/update/files/");
	};
	administratorElems.updateConfig.onclick = function() {
		administrator.request("/update/config/");
	};
	administratorElems.updateDatabase.onclick = function() {
		administrator.request("/update/database/");
	};
	administratorElems.updateRankings.onclick = function() {
		administrator.request("/update/rankings/");
	};
	administratorElems.updateChannelAncestors.onclick = function() {
		administrator.request("/update/channelAncestors/");
	};
	administratorElems.updateStatistics.onclick = function() {
		administrator.request("/statistics/", {}, function(result) {
			DOM.fill(administratorElems.statistics, JSON.stringify(result, undefined, "\t"));
		});
	};
};
