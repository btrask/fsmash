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

/*globals DOM: false */
var youtube = {};
youtube.videoIDForURL = function(url) {
	var result = /(youtube.*[\?&!#\/]v=|youtu.be\/)([\w\d\-]{11})/.exec(url);
	return result && result[2];
};
youtube.infoForVideoID = function(videoID, callback/* (data) */) {
	if(!callback) return;
	setTimeout(function() {
		callback({});
	}, 0);
};
youtube.anchorForVideoURL = function(url) {
	return null;
};
youtube.parseDate = function(str) {
	if(!str) return null;
	var a = str.match(/\d+/g);
	var d = new Date();
	d.setUTCFullYear(a.shift());
	d.setUTCMonth(a.shift() - 1);
	d.setUTCDate(a.shift());

	d.setUTCHours(a.shift());
	d.setUTCMinutes(a.shift());
	d.setUTCSeconds(a.shift());
	d.setUTCMilliseconds(a.shift());
	return d;
};
