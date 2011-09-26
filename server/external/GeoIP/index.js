/* Copyright (c) 2011, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
/* Based on MaxMind GeoIP C API v1.4.6 <http://www.maxmind.com/app/api> */
var fs = require("fs");
var path = require("path");
var util = require("util");

var GEOIP_COUNTRY_EDITION     = 1;
var GEOIP_REGION_EDITION_REV0 = 7;
var GEOIP_CITY_EDITION_REV0   = 6;
var GEOIP_ORG_EDITION         = 5;
var GEOIP_ISP_EDITION         = 4;
var GEOIP_CITY_EDITION_REV1   = 2;
var GEOIP_REGION_EDITION_REV1 = 3;
var GEOIP_PROXY_EDITION       = 8;
var GEOIP_ASNUM_EDITION       = 9;
var GEOIP_NETSPEED_EDITION    = 10;
var GEOIP_DOMAIN_EDITION      = 11;
var GEOIP_COUNTRY_EDITION_V6  = 12;

var STANDARD_RECORD_LENGTH = 3;
var ORG_RECORD_LENGTH = 4;

var COUNTRY_CODES = JSON.parse(fs.readFileSync(path.join(__dirname, "country-codes.json"), "utf8"));
var COUNTRY_NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, "country-names.json"), "utf8"));
var REGION_NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, "region-names.json"), "utf8"));

var COUNTRY_BEGIN = 16776960;
var STATE_BEGIN_REV0 = 16700000;
var STATE_BEGIN_REV1 = 16000000;
var STRUCTURE_INFO_MAX_SIZE = 20;

var FULL_RECORD_LENGTH = 50;

var containsArrayAtPosition = function(array, subarray, position) {
	if(position + subarray.length > array.length) return false;
	for(var i = 0; i < subarray.length; ++i) {
		if(subarray[i] !== array[position + i]) return false;
	}
	return true;
};

var GeoIP = function(path) {
	var geoip = this;

	var fd = fs.openSync(path || "/usr/local/share/GeoIP/GeoLiteCity.dat", "r", 0666);
	var length = fs.fstatSync(fd).size;

	var recordLength = STANDARD_RECORD_LENGTH;
	var edition = GEOIP_COUNTRY_EDITION;
	var segments = [COUNTRY_BEGIN];
	(function setupSegments() {
		var i, position;
		var marker = [0xff, 0xff, 0xff];
		var buf = new Buffer(STRUCTURE_INFO_MAX_SIZE * 4 + 3);
		fs.readSync(fd, buf, 0, buf.length, length - buf.length);
		for(i = 0; i < STRUCTURE_INFO_MAX_SIZE; ++i) {
			position = buf.length - (i * 4 + 3);
			if(!containsArrayAtPosition(buf, marker, position)) continue;
			edition = buf[position + 3];
			if(edition >= 106) edition -= 105;
			switch(edition) {
				case GEOIP_REGION_EDITION_REV0:
					segments = [STATE_BEGIN_REV0];
					break;
				case GEOIP_REGION_EDITION_REV1:
					segments = [STATE_BEGIN_REV1];
					break;
				case GEOIP_ORG_EDITION:
				case GEOIP_ISP_EDITION:
					recordLength = ORG_RECORD_LENGTH;
					// Fall through.
				case GEOIP_CITY_EDITION_REV0:
				case GEOIP_CITY_EDITION_REV1:
				case GEOIP_ASNUM_EDITION:
					segments = [
						buf[position + 4] << (8 * 0) |
						buf[position + 5] << (8 * 1) |
						buf[position + 6] << (8 * 2)
					];
					break;
			}
			break;
		}
		if(GEOIP_CITY_EDITION_REV1 !== edition && GEOIP_CITY_EDITION_REV0 !== edition) throw new Error("City database edition required.");
	})();

	geoip.seekRecord = function(ip, callback/* (err, position, netmask) */) {
		if(ip === null || typeof ip !== "object" || ip.constructor !== Buffer) return callback(new Error("IP address must be a buffer."));
		var buf = new Buffer(recordLength);
		var checkIPBit = function(bit) {
			if(16 === ip.length) return ip[bit >>> 3] & (1 << (~bit & 7)); // Based on GEOIP_CHKBIT_V6(). I don't know why it's different.
			return ip[bit >>> 3] & (1 << (7 - (bit % 8)));
		};
		(function seek(depth, position) {
			if(depth >= ip.length * 8) return callback(new Error("IP internal seek error."));
			var branchOffset = checkIPBit(depth) ? 1 : 0;
			fs.read(fd, buf, 0, recordLength, recordLength * ((2 * position) + branchOffset), function(err, bytesRead) {
				if(err) return callback(err);
				var target = 0, i;
				for(i = 0; i < recordLength; ++i) {
					target |= (buf[i] << (8 * i)) >>> 0;
				}
				if(target >= segments[0]) {
					callback(null, target, 32 - depth);
				} else {
					seek(depth + 1, target);
				}
			});
		})(0, 0);
	};
	geoip.readRecord = function(position, callback/* (err, buf) */) {
		var buf = new Buffer(FULL_RECORD_LENGTH);
		fs.read(fd, buf, 0, FULL_RECORD_LENGTH, position + (2 * recordLength - 1) * segments[0], function(err, bytesRead) {
			callback(err, buf);
		});
	};
	geoip.parseRecord = function(buf, callback/* (err, location) */) {
		var location = {}, position = 0;
		var readCountry = function() {
			location.countryCode = COUNTRY_CODES[buf[position]] || null;
			location.country = COUNTRY_NAMES[buf[position]] || null;
			position++;
		};
		var readString = function() {
			var string = "", prefix, char;
			while((char = buf[position++])) {
				if(char & (1 << 8)) {
					prefix = 0xc2;
					if(-(char & 0x7f) >= -64) prefix++;
					char &= ~0x40;
					string += String.fromCharCode(prefix, char);
				} string += String.fromCharCode(char);
			}
			return string || null;
		};
		var readRegion = function() {
			var region = readString(), country;
			if(REGION_NAMES.hasOwnProperty(location.countryCode)) {
				country = REGION_NAMES[location.countryCode];
				if(country.hasOwnProperty(region)) region = country[region];
			}
			return region;
		};
		var readCoord = function() {
			var coord = 0;
			for(var i = 0; i < 3; ++i) {
				coord |= buf[position + i] << (8 * i);
			}
			position += 3;
			return coord / 10000 - 180;
		};
		var readMetroAndArea = function() {
			var combo = 0;
			if(GEOIP_CITY_EDITION_REV1 === edition) {
				for(var i = 0; i < 3; ++i) {
					combo = buf[position + i] << (8 * i);
				}
				position += 3;
			}
			location.metroCode = Math.floor(combo / 1000) || null;
			location.areaCode = combo % 1000 || null;
		};

		readCountry();
		location.region = readRegion();
		location.city = readString();
		location.postalCode = readString();
		location.latitude = readCoord();
		location.longitude = readCoord();
		readMetroAndArea();

		callback(null, location);
	};
	geoip.lookup = function(ip, callback/* (err, location) */) {
		if(ip === null) return callback(null, {});
		geoip.seekRecord(ip, function(err, position, netmask) {
			if(err) return callback(err);
			geoip.readRecord(position, function(err, buf) {
				if(err) return callback(err);
				geoip.parseRecord(buf, callback);
			});
		});
	};
	geoip.close = function() {
		fs.close(fd);
	};
};
GeoIP.parseIPNumber = function(ip) {
	var x = parseInt(ip, 10);
	if(ip != x) return null;
	return new Buffer([
		x >>> (8 * 3) & 0xff,
		x >>> (8 * 2) & 0xff,
		x >>> (8 * 1) & 0xff,
		x >>> (8 * 0) & 0xff
	]);
};
GeoIP.parseIPv4 = function(ip) {
	var ipv4 = /(\d*)\.(\d*)\.(\d*)\.(\d*)/.exec(ip);
	if(!ipv4) return null;
	var components = [], octet, i;
	for(i = 1; i <= 4; ++i) {
		octet = parseInt(ipv4[i], 10);
		if(octet > 0xff || octet < 0x00) throw new Error("Invalid IPv4 address.");
		components.push(octet);
	}
	return new Buffer(components);
};
GeoIP.parseIPv6 = function(ip) {
	// References: <http://tools.ietf.org/html/rfc2373#section-2.2> <http://tools.ietf.org/html/rfc5952>
	var ipv6 = /([0-9a-f]*:)([0-9a-f]*:)([0-9a-f]*:)?([0-9a-f]*:)?([0-9a-f]*:)?([0-9a-f]*:)?([0-9a-f]*:)?([0-9a-f]*)?/i.exec(ip);
	if(!ipv6) return null;
	var components = [], omitted = 0, component, i;
	for(i = 1; i <= 8; ++i) if(ipv6[i] === undefined || ipv6[i] === ":") omitted++;
	for(i = 1; i <= 8; ++i) {
		if(ipv6[i] === undefined) continue;
		if(ipv6[i] === ":") {
			for(; omitted > 0; --omitted) components.push(0x00, 0x00);
		} else {
			component = parseInt(ipv6[i], 16);
			if(component > 0xffff || component < 0x0000) throw new Error("Invalid IPv6 address");
			components.push(component >>> (8 * 1) & 0xff, component >>> (8 * 0) & 0xff);
		}
	}
	if(16 !== components.length) return null; // In case the address was malformed (too short and with no :: shortener).
	return new Buffer(components);
};
GeoIP.parseIP = function(ip, type) {
	var result = undefined;
	if(type === undefined || type === 0) result = result || GeoIP.parseIPNumber(ip);
	if(type === undefined || type === 4) result = result || GeoIP.parseIPv4(ip);
	if(type === undefined || type === 6) result = result || GeoIP.parseIPv6(ip);
	if(result === undefined) throw new Error("IP internal parsing error (perhaps invalid address type).");
	return result;
};

module.exports = GeoIP;
