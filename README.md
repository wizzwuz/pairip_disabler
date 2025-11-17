# pairip_disabler

This module disables pairip license activity in apps. It can't disable libpairip.so.

Haven't tested in `magisk` and `apatch`. I need someone to test it please do let me know.

you can also disable pairip via termux command:
```
su -c "am force-stop <package_name> && pm disable <package_name>/com.pairip.licensecheck.LicenseActivity"
```
