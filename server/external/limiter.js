/* Copyright (C) 2011 Ben Trask

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
var limiter = exports;

limiter.throttle = function(rate, penalize, onClear, onLimit) {
	var attempts = [], timeout = null;
	var minimum = function(index) {
		return rate.run * Math.pow((index + 1) / rate.rise, 3);
	};
	var bump = function(now) {
		attempts.unshift(now);
		while(attempts.length > rate.rise) attempts.pop();
		if(timeout) clearTimeout(timeout);
		timeout = setTimeout(function idle() {
			timeout = null;
			attempts = [];
			if(onClear) onClear();
		}, minimum(rate.rise - 1));
	};
	return function() {
		var now = new Date().getTime(), age, i;
		for(i = 0; i < attempts.length; ++i) {
			age = now - attempts[i];
			if(age >= minimum(i)) continue;
			if(penalize) bump(now);
			if(onLimit) onLimit();
			return true;
		}
		bump(now);
		return false;
	};
};
limiter.batch = function(onBatch, delay) {
	var timeout = null;
	return function() {
		if(!timeout) timeout = setTimeout(function idle() {
			timeout = null;
			onBatch();
		}, delay);
	};
};
limiter.idle = function(onIdle, delay) {
	var timeout = null;
	return function() {
		if(timeout) clearTimeout(timeout);
		timeout = setTimeout(function batch() {
			timeout = null;
			onIdle();
		}, delay);
	};
};


