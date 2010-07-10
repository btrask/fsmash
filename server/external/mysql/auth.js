var crypto = require('crypto');

function sha1(message) {
    return crypto.createHash("sha1").update(message).digest();
}

function encrypt_password(plain, scramble) {
    var stage1 = sha1(plain);
    var stage2 = sha1(scramble + sha1(stage1));
    var result = "";
    for (var i = 0; i < stage1.length; ++i) {
        result += String.fromCharCode(stage1.charCodeAt(i)
                ^ stage2.charCodeAt(i));
    }
    return result;
}

exports.encrypt_password = encrypt_password;

/*
 * node-mysql A node.js interface for MySQL
 * http://github.com/masuidrive/node-mysql
 * 
 * Copyright (c) Yuichiro MASUI <masui@masuidrive.jp> License: MIT License
 */
