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
var bt;
try { bt = exports; } catch(e) { bt = {}; }

if(!Array.prototype.indexOf) Array.prototype.indexOf = function(val) {
	for(var i = 0; i < this.length; i++) if(val === this[i]) return i;
	return -1;
};

bt.curry = function(func, arg1, arg2, etc) {
	var args = Array.prototype.slice.call(arguments, 1);
	return function(arg3, arg4, etc) {
		return Function.prototype.apply.call(func, this, args.concat(Array.prototype.slice.call(arguments)));
	};
};
bt.scope = function(func, target) {
	return function(arg1, arg2, etc) {
		return Function.prototype.apply.call(func, target, arguments);
	};
};
bt.hasOwnProperties = function(obj) {
	for(var prop in obj) if(obj.hasOwnProperty(prop)) return true;
	return false;
};
bt.mixin = function(target, obj1, obj2, etc) {
	var i;
	for(i = 1; i < arguments.length; i++) for(var prop in arguments[i]) if(arguments[i].hasOwnProperty(prop) && undefined !== arguments[i][prop]) target[prop] = arguments[i][prop];
	return target;
};
bt.union = function(obj1, obj2, etc) {
	return bt.mixin.apply(bt, [{}].concat(Array.prototype.slice.call(arguments)));
};
bt.components = function(path) {
	var stripped;
	if(!path) return [];
	stripped = /[^\/].*[^\/]/.exec(path);
	if(!stripped) return [];
	return stripped[0].split("/");
};
bt.dispatch = function(leaf/* (args...) */, branch/* (func, args...) */, lookup/* (args...) */) {
	return function(unknown, components, arg1, arg2, etc) {
		var args = Array.prototype.slice.call(arguments, 2);
		var obj, component, func;
		if(components.length) {
			if(lookup) obj = lookup.apply(arguments.callee, args);
			else obj = arguments.callee;
			if(!obj) return unknown;
			component = components.shift();
			if(obj.hasOwnProperty(component)) func = obj[component];
			if(!func) return unknown;
			if(branch) return branch.apply(arguments.callee, [bt.curry(func, unknown, components)].concat(args));
			return Function.prototype.apply.call(func, arguments.callee, arguments);
		} else if(leaf) return leaf.apply(arguments.callee, args);
		return unknown;
	};
};
bt.limit = function(rate/* {rise, run} */, onzero, onlimit) {
	var count = 0;
	return function bump(ondecrease, onincrease) {
		if(count > rate.rise) return true;
		count++;
		if(onincrease) onincrease();
		if(count > rate.rise && onlimit) onlimit();
		setTimeout(function() {
			count--;
			if(ondecrease) ondecrease();
			if(!count && onzero) onzero();
		}, rate.run);
		return count > rate.rise;
	};
};

bt.map = function(obj, callback/* (value, key, obj) */) {
	var result, i, key, value;
	if(obj.length >= 0) {
		result = [];
		for(i = 0; i < obj.length; ++i) {
			value = callback(obj[i], i, obj);
			if(undefined !== value) result.push(value);
		}
	} else {
		result = {};
		for(key in obj) if(obj.hasOwnProperty(key)) {
			value = callback(obj[key], key, obj);
			if(undefined !== value) result[key] = value;
		}
	}
	return result;
};
bt.pair = function(keys, values) {
	var obj = {};
	for(var i = 0; i < keys.length; ++i) obj[keys[i]] = values[i];
	return obj;
};

bt.array = {};
bt.array.indexOf = function(array, val, func) {
	if(!func) return Array.prototype.indexOf.call(array, val);
	for(var i = 0; i < array.length; i++) if(val === func(array[i])) return i;
	return -1;
};
bt.array.removeObject = function(array, val) {
	var i = array.indexOf(val);
	if(-1 !== i) array.splice(i, 1);
};
