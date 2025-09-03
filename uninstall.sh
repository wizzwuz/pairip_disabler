#!/system/bin/sh
pkill -f "httpd.*8080"
echo "License Activity Disabler module uninstalled" >> /data/local/tmp/license_disabler.log
rm -f /data/local/tmp/license_disabler.log
