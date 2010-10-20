fsmash.org site software
========================

fsmash is the software that powers http://fsmash.org. It requires node.js and MySQL.

Installation
------------

1. Install node-crypt on the server (see below)
2. `cd` to the `fsmash` directory
3. Run `make gzip-only`
4. Upload `/public`, `/server`, and `/shared` to the server
5. On the server:
6. Edit `/server/config.json`
7. Create `/server/db.json` and `/server/paypal.json` (see samples below)
8. Configure the MySQL database (see below)
9. Run `./server/server.js`

Installing node-crypt
---------------------

`node-crypt` is include with (and required for) fsmash. It is a module that adds support for password hashing using bcrypt to node. It is distinct from `node-crypto` or the node `crypto` module.

1. Upload `/deps/node-crypt` to the server
2. On the server:
3. `cd` to the `node-crypt` directory
4. Run `node-waf configure`
5. Run `node-waf build`
6. Run `node-waf install`

MySQL database configuration
----------------------------

1. Create the database schema using `/resources/database.sql`
2. Install up-to-date IP geolocation tables from `http://ipinfodb.com/ip_database.php` (use the multi-table "Complete (City)" version)
3. Create some `channels` and add them to `publicChannels`
4. Add `matchTypes`, `rules`, and `soundsets`
5. Configure your account as an `admin`

Sample /server/db.json
----------------------

	{
		"host": "localhost",
		"port": 3306,
		"user": "root",
		"password": "root",
		"database": "fsmash"
	}

Sample /server/paypal.json
--------------------------

	{
		"host": "www.paypal.com",
		"receiverEmail": "you@email.com",
		"minimumPayment": 5.00
	}
