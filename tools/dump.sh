#!/bin/sh
date=`date +%F`
mysqldump -uroot -p fsmash | gzip > "$date-fsmash.sql.gz"
