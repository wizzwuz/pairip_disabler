#!/system/bin/sh
MODDIR=${0%/*}
sleep 30
cd $MODDIR/webroot
pkill -f "httpd.*8080"
busybox httpd -p 8080 -h . &
echo "License Activity Disabler web server started on port 8080" >> /data/local/tmp/license_disabler.log
