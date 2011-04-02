fsmash.org site software
========================

fsmash is the software that powers <http://fsmash.org/>. It requires node.js and MySQL.

Installation
------------

1. `cd` to the `fsmash` directory
2. Run `make release`
3. Upload `/public`, `/server`, and `/shared` to the server
4. On the server:
5. Install the IP geolocation database from <http://www.maxmind.com/app/geolitecity>
6. Configure the server (see below)
7. Configure the MySQL database (see below)
8. Install `node-crypt` (see below)
9. Run `./server/server.js`

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
		},
		"GeoIP": {
			"path": null
		}
	}

If you installed the IP geolocation database in the default location, you don't need to specify a path for it.

MySQL database configuration
----------------------------

1. Create the database schema using `/resources/database.sql`
2. Create some `channels` and add them to `publicChannels`
3. Add `matchTypes`, `rules`, and `soundsets`
4. Configure your account as an `administrator`

Installing node-crypt
---------------------

`node-crypt` is include with (and required for) fsmash. It is a module that adds support for password hashing using bcrypt to node. It is distinct from `node-crypto` or the node `crypto` module.

1. Upload `/deps/node-crypt` to the server
2. On the server:
3. `cd` to the `node-crypt` directory
4. Run `node-waf configure build install`
