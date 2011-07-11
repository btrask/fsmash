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

/*globals bt: false, youtube: false */
var DOM = {};
DOM.id = function(id) {
	return document.getElementById(id);
};

DOM.clone = function(id, childByID) {
	var element = document.getElementById(id).cloneNode(true);
	element.id = "";
	if(childByID) (function findIDsInElement(elem) {
		var children = elem.childNodes, length = children.length, i = 0, dataID;
		if(elem.getAttribute) dataID = elem.getAttribute("data-id");
		if(dataID) childByID[dataID] = elem;
		for(; i < length; ++i) findIDsInElement(children[i]);
	})(element);
	return element;
};
DOM.remove = function(elem) {
	if(elem.parentNode) elem.parentNode.removeChild(elem);
};
DOM.fill = function(elem, child1, child2, etc) {
	var i = 1, type;
	while(elem.hasChildNodes()) elem.removeChild(elem.firstChild);
	for(; i < arguments.length; ++i) if(arguments[i]) {
		type = typeof arguments[i];
		if("string" === type || "number" === type) {
			elem.appendChild(document.createTextNode(arguments[i]));
		} else {
			elem.appendChild(arguments[i]);
		}
	}
};
DOM.classify = function(elem, className, add) {
	var classes = (elem.className || "").split(" "),
		changed = (className || "").split(" "),
		length = changed.length, i = 0, index;
	if(add || undefined === add) for(; i < length; ++i) {
		index = classes.indexOf(changed[i]);
		if(index < 0) classes.push(changed[i]);
	} else for(; i < length; ++i) {
		index = classes.indexOf(changed[i]);
		if(index >= 0) classes.splice(index, 1);
	}
	elem.className = classes.join(" ");
};

DOM.linkify = function(string) {
	var remainder = string;
	var span = document.createElement("span");
	var URL, anchor, index;
	var fullURLRegExp = /[\w\-]+:\/\/?[\w\d\/!@#$%\^&*?.=+\-:~]+[\w\d\/&#*]/;
	var emailRegExp = /[\w\d.\-]+@[\w\d.\-]+[.][\w\d.\-]*[\w\d]/;
	var allRegExp = new RegExp(fullURLRegExp.source + "|" + emailRegExp.source);
	while((URL = allRegExp.exec(remainder))) {
		URL = URL[0];
		index = remainder.indexOf(URL);
		anchor = youtube.anchorForVideoURL(URL);
		if(!anchor) {
			anchor = DOM.clone("anchor");
			DOM.fill(anchor, URL);
			if(emailRegExp.test(URL)) anchor.href = "mailto:" + URL;
			else anchor.href = URL;
		}
		span.appendChild(document.createTextNode(remainder.slice(0, index)));
		if(anchor) span.appendChild(anchor);
		remainder = remainder.slice(index + URL.length);
	}
	span.appendChild(document.createTextNode(remainder));
	return span;
};
DOM.inputify = function(string) {
	var match = /(.*[\S].*)[\s]<-[\s](.*[\S].*)/.exec(string);
	if(!match) return DOM.linkify(string);
	var quote = DOM.linkify(match[1]);
	var comment = DOM.linkify(match[2]);
	DOM.classify(quote, "quote");
	var span = document.createElement("span");
	DOM.fill(span, quote, " <- ", comment);
	return span;
};

DOM.input = {};
DOM.input.enable = function(elem1, elem2, etc, flag) {
	var args = Array.prototype.slice.call(arguments);
	flag = !args.pop();
	bt.map(args, function(arg) {
		arg.disabled = flag;
		DOM.classify(arg, "disabled", flag);
	});
};

DOM.event = {};
DOM.event.isReturn = function(event) {
	if(!event) event = window.event;
	if(!event) return false;
	var keyCode = event.keyCode;
	return 13 === parseInt(keyCode, 10) || 10 === parseInt(keyCode, 10);
};

DOM.field = {};
DOM.field.focus = function(field) {
	if(/iPhone|iPad/i.test(navigator.userAgent)) return; // Shows the keyboard.
	if(/Opera/i.test(navigator.userAgent)) return; // Scrolls off the top of the screen.
	field.focus();
};
DOM.field.onChange = function(elem1, elem2, etc, callback) {
	callback = arguments[arguments.length - 1];
	bt.map(arguments, function(elem) {
		elem.onchange = callback;
		elem.onkeypress = function(event) {
			if(DOM.event.isReturn(event)) this.blur();
		};
	});
};
DOM.field.placeholder = function(elem1, elem2, etc) {
	var elem, i;
	bt.map(arguments, function(elem) {
		DOM.classify(elem, "placeholder", elem.value === this.title);
		elem.onfocus = function() {
			if(this.value !== this.title) return;
			this.value = "";
			DOM.classify(this, "placeholder", false);
		};
		elem.onblur = function() {
			if(this.value) return;
			this.value = this.title;
			DOM.classify(this, "placeholder");
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
		DOM.classify(button, "confirm", false);
		button.onclick = onclick;
	}, 1000 * 1);
	button.value = "Confirm";
	DOM.classify(button, "confirm");
	button.onclick = function(arg1, arg2, etc) {
		clearTimeout(timeout);
		button.value = value;
		DOM.classify(button, "confirm", false);
		button.onclick = onclick;
		return action.apply(this, arguments);
	};
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
		if(String(value) !== String(select.options[i].value)) continue;
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
