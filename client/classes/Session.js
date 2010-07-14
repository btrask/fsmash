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
var Session = function() {
	var session = this;

	var pending = {
		requests: [],
		callbackByPromiseID: {},
		dataByPromiseID: {}
	};
	var accountItem = new SidebarItem("Account");

	var askForSignin = function() {
		var delay = false;
		var authElems = {};
		var signin = function(signup, event) {
			if(delay) return;
			DOM.input.enable(authElems.signinButton, authElems.signupButton, false);
			session.request("/user/", {userName: authElems.userNameField.value, password: authElems.passwordField.value, signup: signup}, function(error) {
				if(!error) return;
				DOM.fill(authElems.error, error);
				delay = true;
				setTimeout(function() {
					delay = false;
					DOM.input.enable(authElems.signinButton, authElems.signupButton, true);
				}, 1000 * 1);
			});
		};
		accountItem.setContent(DOM.clone("authenticate", authElems));
		accountItem.onshow = function() {
			DOM.field.focus(authElems.userNameField);
		};
		accountItem.onshow();
		authElems.signinButton.onclick = bt.curry(signin, false);
		authElems.signupButton.onclick = bt.curry(signin, true);
		authElems.userNameField.onkeypress = function(event) {
			if(DOM.event.isReturn(event)) DOM.field.focus(authElems.passwordField);
		};
		authElems.passwordField.onkeypress = function(event) {
			if(DOM.event.isReturn(event)) signin(false);
		};
	};

	session.siteItem = new SidebarItem("FSMASH.org");
	session.siteItem.children.appendChild(accountItem.element);

	session.sidebar = DOM.clone("sidebarList");
	session.sidebar.appendChild(session.siteItem.element);
	DOM.id("sidebar").appendChild(session.sidebar);

	accountItem.setContent(DOM.clone("loading"));
	accountItem.select(true);

	session.info = {};
	session.user = null;
	Session.all.push(session);

	session.request = function(path, props, callback) {
		pending.requests.push({path: path, props: props || {}, callback: callback});
		if(1 === pending.requests.length) (function nextRequest() {
			var request = pending.requests.shift();
			Session.request("/session" + request.path, bt.union(request.props, session.info), function(obj) {
				if(obj && obj.needsNewSession) {
					session.terminate();
					return;
				}
				if(obj && obj.error) throw obj.error;
				if(request.callback) {
					if(!obj || !obj.promiseID) {
						request.callback(obj);
					} else if(pending.dataByPromiseID.hasOwnProperty(obj.promiseID)) {
						request.callback(pending.dataByPromiseID[obj.promiseID]);
					} else {
						pending.callbackByPromiseID[obj.promiseID] = request.callback;
					}
				}
				if(pending.requests.length) nextRequest();
			});
		})();
	};
	session.terminate = function() {
		window.location = window.location;
	};

	session.event = bt.dispatch();
	session.event.user = bt.dispatch(function(body) {
		if(body.accountError) return body.accountError;
		if(!session.user) session.user = new User(session, body.userID);
		session.user.info = body;
		Session.byUserID[session.user.info.userID] = session;
		session.user.updateWithInfo();
		if(session.user.info.userName) DOM.fill(accountItem.title, session.user.info.userName);
		accountItem.setContent(session.user.account);
	}, null, function(body) {
		return session.user ? session.user.event : null;
	});
	session.event.videos = bt.dispatch(function(body) {
		session.videosPage.add(body);
	});

	session.aboutPage = new AboutPage(session);
	session.videosPage = new VideosPage(session);

	(function() {
		var modals = [];
		session.showModal = function(modal) {
			modals.push(modal);
			DOM.id("modal").appendChild(modal);
		};
		session.closeAllModals = function() {
			bt.map(modals, function(modal) {
				DOM.remove(modal);
			});
		};
	})();

	session.request("/", {}, function(info) {
		session.info = info;

		var tokenInfo = {
			userName: cookie.get("userName"),
			userToken: cookie.get("userToken"),
			signup: false
		};
		if(tokenInfo.userName && !cookie.get("requirePassword")) {
			session.request("/user/", tokenInfo, function(error) {
				if(!error) return;
				cookie.clear("userName");
				cookie.clear("userToken");
				askForSignin();
			});
		} else {
			cookie.clear("requirePassword");
			askForSignin();
		}

		session.watch = function() {
			Session.request("/session/watch/", session.info, function(events) {
				if(!events) return session.watch();
				if(events.needsNewSession) {
					session.terminate();
					return;
				}
				if(events.length) bt.map(events, function(event) {
					if(!event.body) event.body = {};
					if(undefined !== event.body.error) throw event.body.error;
					var result = session.event(undefined, bt.components(event.path), event.body);
					if(undefined === event.promiseID) return;
					if(pending.callbackByPromiseID.hasOwnProperty(event.promiseID)) {
						pending.callbackByPromiseID[event.promiseID](result);
					} else {
						pending.dataByPromiseID[event.promiseID] = result;
					}
				});
				session.watch();
			});
		};
		if(!window.onload) session.watch();
	});
};
Session.request = function(path, properties, callback) {
	var req = null;
	if(window.XMLHttpRequest && !window.ActiveXObject) {
		try { req = new XMLHttpRequest() } catch(e) {}
	} else if(window.ActiveXObject) {
		try { req = new ActiveXObject("Msxml2.XMLHTTP") } catch(e) {
			try { req = new ActiveXObject("Microsoft.XMLHTTP") } catch(e) {}
		}
	}
	req.open("POST", "/api" + path + "?r=" + new Date().getTime(), true);
	req.onreadystatechange = function() {
		if(4 !== req.readyState) return;
		DOM.changeClass(DOM.id("connectionError"), "invisible", 200 === req.status);
		if(200 === req.status || 500 === req.status) callback(req.responseText ? JSON.parse(req.responseText) : false);
		else setTimeout(bt.curry(Session.request, path, properties, callback), 1000 * 5);
	};
	req.setRequestHeader("Content-Type", "text/json");
	req.send(JSON.stringify(properties || {}));
};
Session.all = [];
Session.byUserID = {};
