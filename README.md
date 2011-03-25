fsmash.org site software
========================

fsmash is the software that powers <http://fsmash.org/>. It requires node.js and MySQL.

Installation
------------

1. `cd` to the `fsmash` directory
2. Run `make release`
3. Upload `/public`, `/server`, and `/shared` to the server
4. On the server:
5. Configure the server (see below)
6. Configure the MySQL database (see below)
7. Install `node-crypt` (see below)
8. Run `./server/server.js`

Configuring the server
----------------------

Configuration files are stored in `/server/config/`. JSON files in this folder are read (in order of Array.sort) and deep-merged to produce a single config object. Values in later files overwrite values for the same property in earlier files. Instead of changing the existing files, it is recommended to create an additional file that overrides any necessary default values. This file should be named such that it appears last when sorted.

Example `zz01-secret.json`
	{
		"PayPal": {
			"verify": {
				"receiver_email": "you@example.com"
			}
		},
		"server": {
			"port": 8001
		},
		"database": {
			"password": ""
		}
	}

MySQL database configuration
----------------------------

1. Create the database schema using `/resources/database.sql`
2. Install up-to-date IP geolocation tables from <http://ipinfodb.com/ip_database.php> (use the multi-table "Complete (City)" version)
3. Create some `channels` and add them to `publicChannels`
4. Add `matchTypes`, `rules`, and `soundsets`
5. Configure your account as an `administrator`

Installing node-crypt
---------------------

`node-crypt` is include with (and required for) fsmash. It is a module that adds support for password hashing using bcrypt to node. It is distinct from `node-crypto` or the node `crypto` module.

1. Upload `/deps/node-crypt` to the server
2. On the server:
3. `cd` to the `node-crypt` directory
4. Run `node-waf configure build install`
