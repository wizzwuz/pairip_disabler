#!/system/bin/sh

MODDIR=${0%/*}
WEBROOT=$MODDIR/webroot

# Get all package names (system + user apps)
PACKAGES=$(pm list packages | cut -d ':' -f2)

# Create JSON array in webroot
cd $WEBROOT
echo '[' > applist.json

FIRST=1
for PKG in $PACKAGES; do
  if [ $FIRST -eq 0 ]; then
    echo ',' >> applist.json
  fi
  echo "\"$PKG\"" >> applist.json
  FIRST=0
done

echo ']' >> applist.json

# Create empty disabled.json
echo '[]' > disabled.json

# Set permissions (optional, KernelSU handles most)
chmod 644 applist.json disabled.json