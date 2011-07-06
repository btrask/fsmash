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
(function() {
	var resizer = DOM.id("resizer");
	var sidebar = DOM.id("sidebar");
	var main = DOM.id("main");
	var setWidth = function(x) {
		if(undefined === x) return;
		x = Math.min(x, document.body.offsetWidth - 323);
		x = Math.max(x, 100);
		sidebar.style.width = x + "px";
		resizer.style.left = (x - 3) + "px";
		main.style.left = (x + 1) + "px";
	};
	setWidth(cookie.get("SidebarWidth"));
	resizer.onmousedown = function() {
		var newWidth;
		document.onmousemove = function(event) {
			if(!event) event = window.event;
			newWidth = event.clientX;
			setWidth(newWidth);
			return false;
		};
		document.onmouseup = function() {
			document.onmousemove = null;
			document.onmouseup = null;
			if(undefined !== newWidth) cookie.set("SidebarWidth", newWidth);
			return false;
		};
		return false;
	};
})();
document.onkeydown = document.onkeypress = function(event) {
	if(!event) event = window.event;
	if(8 != (event.keyCode || event.which)) return true;
	var target = event.target || event.srcElement;
	if(target && target.type && /password|text|file/i.test(target.type)) return true;
	if(event.preventDefault) event.preventDefault();
	return false;
};
document.body.onmousemove = document.body.onkeydown = function() {
	bt.map(Session.byUserID, function(session) {
		session.user.resetIdleTimeout();
	});
};
window.onload = function() {
	setTimeout(function() {
		window.onload = null;
		bt.map(Session.all, function(session) {
			if(session.watch) session.watch();
		});
	}, 1000); // Wait for the browser to realize that we're done loading the main page. I wish I knew a better way to do this. window.onload by itself doesn't cut it.
};
DOM.classify(DOM.id("body"), "invisible", false);
new Session();
