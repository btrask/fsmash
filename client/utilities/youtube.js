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
var youtube = {};
youtube.dataByVideoID = {};
youtube.callbackByUniqueID = {};
youtube.uniqueID = 0;
youtube.videoIDForURL = function(url) {
	var result = /(youtube.*[\?&!#\/]v=|youtu.be\/)([\w\d-]{11})/.exec(url);
	return result && result[2];
};
youtube.infoForVideoID = function(videoID, callback/* (data) */) {
	if(youtube.dataByVideoID.hasOwnProperty(videoID)) {
		if(callback) callback(youtube.dataByVideoID[videoID]);
		return;
	}
	var uniqueID = ++youtube.uniqueID;
	var script = document.createElement("script");
	var timeout = setTimeout(function() {
		if(callback) callback({});
		callback = null;
		DOM.remove(script);
	}, 1000 * 5);
	youtube.callbackByUniqueID[uniqueID] = function(info) {
		var data = (info && info.data) || {};
		clearTimeout(timeout);
		youtube.dataByVideoID[videoID] = data;
		if(callback) callback(data);
		delete youtube.callbackByUniqueID[uniqueID];
		DOM.remove(script);
	};
	script.type = "text/javascript";
	script.src = "http://gdata.youtube.com/feeds/api/videos/"+encodeURIComponent(videoID)+"?v=2&alt=jsonc&callback=youtube.callbackByUniqueID["+encodeURIComponent(uniqueID)+"]";
	document.body.appendChild(script);
};
youtube.anchorForVideoURL = function(url) {
	var videoID = youtube.videoIDForURL(url);
	var time = /[#!|#|\?|&]t=([hms\d]+)/.exec(url);
	var anchor;
	if(!videoID) return null;
	anchor = DOM.clone("anchor");
	anchor.href = "http://www.youtube.com/watch?v=" + videoID;
	if(time) anchor.href += "#t=" + time[1];
	DOM.fill(anchor, "Loading video…");
	youtube.infoForVideoID(videoID, function(data) {
		DOM.fill(anchor, data.title || "Unknown video");
	});
	return anchor;
};
