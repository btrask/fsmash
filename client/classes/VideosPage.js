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

/*globals bt: false, DOM: false, youtube: false, SidebarItem: false */
var VideosPage = function(session) {
	var videosPage = this;

	var videosElems = {};
	var count = {
		total: 0,
		unseen: 0
	};

	videosPage.sidebarItem = new SidebarItem("Videos");
	session.siteItem.children.appendChild(videosPage.sidebarItem.element);
	videosPage.sidebarItem.setContent(DOM.clone("videos", videosElems));
	videosPage.sidebarItem.onshow = function() {
		if(count.total < 10) videosElems.more.onclick();
		count.unseen = 0;
		DOM.fill(videosPage.sidebarItem.counter);
	};
	DOM.field.placeholder(videosElems.videoURL);

	videosElems.more.onclick = function() {
		session.request("/videos/", {start: count.total});
	};
	videosElems.submit.onclick = function() {
		if(!session.user) throw new Error("Only users can submit videos");
		var videoID = youtube.videoIDForURL(videosElems.videoURL.value);
		if(videoID) session.user.request("/video/", {youtubeID: videoID});
		videosElems.videoURL.value = "";
		videosElems.videoURL.onblur();
	};
	videosElems.videoURL.onkeypress = function(event) {
		if(!DOM.event.isReturn(event)) return;
		videosElems.submit.onclick();
		this.blur();
	};

	videosPage.allowSubmissions = function() {
		DOM.classify(videosElems.submitPane, "invisible", false);
	};
	videosPage.add = function(body) {
		if(!body.videos) return;
		count.total += body.videos.length;
		var videos = bt.map(body.videos, function(videoInfo) {
			var videoElems = {};
			var video = DOM.clone("video", videoElems);
			videoElems.anchor.href = "http://www.youtube.com/watch?v=" + videoInfo.youtubeID;
			DOM.fill(videoElems.submitterName, videoInfo.userName);
			youtube.infoForVideoID(videoInfo.youtubeID, function(data) {
				videoElems.thumbnail.src = ((data.thumbnail || {}).sqDefault || "").
					replace(/^http:/, "https:");
				DOM.fill(videoElems.anchor, data.title || "Unknown video");
				DOM.fill(videoElems.uploaderName, data.uploader || "Unknown");
				DOM.fill(videoElems.uploadDate, data.uploaded ? youtube.parseDate(data.uploaded).toLocaleDateString() : "Unknown");
				videoElems.uploaderName.href = "http://www.youtube.com/user/"+data.uploader;
				if(data.duration) DOM.fill(videoElems.duration, "" + Math.floor(data.duration / 60) + ":" + ("0" + (data.duration % 60)).slice(-2));
			});
			return video;
		});
		if(body.old) {
			bt.map(videos, function(video) {
				videosElems.videos.appendChild(video);
			});
			return;
		}
		bt.map(videos.reverse(), function(video) {
			videosElems.videos.insertBefore(video, videosElems.videos.firstChild);
		});
		if(videosPage.sidebarItem.selected) return;
		count.unseen += videos.length;
		DOM.fill(videosPage.sidebarItem.counter, count.unseen);
	};
};
