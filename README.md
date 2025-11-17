# pairip_disabler

This module disables pairip license activity in apps. It can't disable libpairip.so.

you can also disable pairip via termux command:
'''
su -c "am force-stop <package_name> && pm disable <package_name>/com.pairip.licensecheck.LicenseActivity"
'''
