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
var DOM = {};
DOM.id = function(id) {
	return document.getElementById(id);
};
DOM.clone = function(id, childByID) {
	var element = DOM.id(id).cloneNode(true);
	element.id = "";
	if(childByID) (function findIDsInElement(elem) {
		var dataID;
		if(elem.getAttribute) dataID = elem.getAttribute("data-id");
		if(dataID) childByID[dataID] = elem;
		bt.map(elem.childNodes, function(child) {
			findIDsInElement(child);
		});
	})(element);
	return element;
};
DOM.toElement = function(obj) {
	if(null === obj || undefined === obj) obj = "";
	switch(obj.constructor) {
		case String:
		case Number:
			return document.createTextNode(obj.toString());
	}
	return obj;
};
DOM.remove = function(elem) {
	if(elem && elem.parentNode) elem.parentNode.removeChild(elem);
};
DOM.fill = function(elem, child1, child2, etc) {
	var i;
	if(!elem) return;
	while(elem.hasChildNodes()) elem.removeChild(elem.firstChild);
	for(i = 1; i < arguments.length; ++i) if(arguments[i]) elem.appendChild(DOM.toElement(arguments[i]));
};
DOM.changeClass = function(elem, classString, add) {
	var classes = elem.className ? elem.className.split(" ") : [];
	var changedClasses = classString ? classString.toString().split(" ") : [];
	bt.map(changedClasses, function(changedClass) {
		var index = classes.indexOf(changedClass);
		if(add || undefined === add) {
			if(-1 === index) classes.push(changedClass);
		} else {
			if(-1 !== index) classes.splice(index, 1);
		}
	});
	elem.className = classes.join(" ");
};
DOM.linkify = function(string) {
	var remainder = string;
	var span = document.createElement("span");
	var URL, anchor, index;
	var fullURLRegExp = /[\w-]+:\/\/?[\w\d\/!@#$%^&*?.=+-:~]+[\w\d\/&#*]/;
	var emailRegExp = /[\w\d.-]+@[\w\d.-]+[.][\w\d.-]*[\w\d]/;
	var allRegExp = new RegExp(fullURLRegExp.source + "|" + emailRegExp.source0);
	while(URL = allRegExp.exec(remainder)) {
		URL = URL[0];
		index = remainder.indexOf(URL);
		anchor = youtube.anchorForVideoID(youtube.videoIDForURL(URL));
		if(!anchor) {
			anchor = DOM.clone("anchor");
			DOM.fill(anchor, URL);
			if(emailRegExp.test(URL)) anchor.href = "mailto:" + URL;
			else anchor.href = URL;
		}
		span.appendChild(DOM.toElement(remainder.substr(0, index)));
		if(anchor) span.appendChild(anchor);
		remainder = remainder.substr(index + URL.length);
	}
	span.appendChild(DOM.toElement(remainder));
	return span;
};

DOM.input = {};
DOM.input.enable = function(elem1, elem2, etc, flag) {
	var args = Array.prototype.slice.call(arguments);
	var flag = !args.pop();
	bt.map(args, function(arg) {
		arg.disabled = flag;
		DOM.changeClass(arg, "disabled", flag);
	});
};

DOM.event = {};
DOM.event.isReturn = function(event) {
	if(!event) event = window.event;
	if(!event) return false;
	var keyCode = event.keyCode;
	return 13 == keyCode || 10 == keyCode;
};

DOM.field = {};
DOM.field.onChange = function(elem1, elem2, etc, callback) {
	var callback = arguments[arguments.length - 1], i;
	for(var i = 0; i < arguments.length - 1; ++i) {
		arguments[i].onchange = callback;
		arguments[i].onkeypress = function(event) {
			if(DOM.event.isReturn(event)) this.blur();
		};
	}
};
DOM.field.placeholder = function(elem1, elem2, etc) {
	var elem, i;
	bt.map(arguments, function(elem) {
		DOM.changeClass(elem, "placeholder", elem.value === this.title);
		elem.onfocus = function() {
			if(this.value !== this.title) return;
			this.value = "";
			DOM.changeClass(this, "placeholder", false);
		};
		elem.onblur = function() {
			if(this.value) return;
			this.value = this.title;
			DOM.changeClass(this, "placeholder");
		};
		elem.onblur();
	});
};

DOM.button = {};
DOM.button.confirm = function(button, action) {
	var value = button.value;
	var onclick = button.onclick;
	var timeout = setTimeout(function() {
		button.value = value;
		DOM.changeClass(button, "confirm", false);
		button.onclick = onclick;
	}, 1000 * 1);
	button.value = "Confirm";
	DOM.changeClass(button, "confirm");
	button.onclick = function(arg1, arg2, etc) {
		clearTimeout(timeout);
		button.value = value;
		DOM.changeClass(button, "confirm", false);
		button.onclick = onclick;
		return action.apply(this, arguments);
	}
};

DOM.select = {};
DOM.select.option = function(label, value) {
	var option = document.createElement("option");
	DOM.fill(option, label);
	if(undefined !== value) option.value = value;
	return option;
};
DOM.select.choose = function(select, value) {
	for(var i = 0; i < select.options.length; ++i) {
		if(value != select.options[i].value) continue;
		select.selectedIndex = i;
		return true;
	}
	select.selectedIndex = 0;
	return false;
};

DOM.scroll = {};
DOM.scroll.toBottom = function(element) {
	element.scrollTop = element.scrollHeight;
};
DOM.scroll.preserve = function(element, func) {
	var scroll = element.scrollTop >= (element.scrollHeight - element.clientHeight);
	func();
	if(scroll) DOM.scroll.toBottom(element);
};
