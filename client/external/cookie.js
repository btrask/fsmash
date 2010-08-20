/* Based on http://www.quirksmode.org/js/cookies.html */
var cookie = {};
cookie.set = function(name, value, days) {
	if(days) value += "; expires="+new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * days)).toGMTString();
	document.cookie = name+"="+value+"; path=/";
};
cookie.get = function(name) {
	var ca = document.cookie.split(";"), c;
	name += "=";
	for(var i = 0; i < ca.length; i++) {
		c = ca[i].replace(/^\s*/, "");
		if(0 === c.indexOf(name)) return c.slice(name.length, c.length);
	}
	return null;
};
cookie.clear = function(name) {
	cookie.set(name, "", -1);
};
