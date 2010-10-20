fsmash.org site software
========================

Installation
------------

1. Run `make gzip-only`
2. Upload `/public`, `/server`, and `/shared` to your server
3. Create the database using `/resources/database.sql`
4. Edit `/server/config.json`
5. Create `/server/db.json` and `/server/paypal.json`
6. Run `./server/server.js`

db.json
-------

	{
		"host": "localhost",
		"port": 3306,
		"user": "root",
		"password": "root",
		"database": "fsmash"
	}

paypal.json
-----------

	{
		"host": "www.paypal.com",
		"receiverEmail": "you@email.com",
		"minimumPayment": 5.00
	}
