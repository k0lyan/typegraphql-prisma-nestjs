#!/bin/bash
set -e
START_TIME=$SECONDS

echo "Building package..."
rm -rf lib 2>/dev/null || true
npx tsc
rm -rf package 2>/dev/null || true
mkdir package

echo "Copying files..."
cp -r lib package/lib
cp package.json Readme.md LICENSE package

echo "Adjusting package.json..."
sed -i 's/"private": true/"private": false/' ./package/package.json
npm pkg delete scripts.prepare --prefix ./package

ELAPSED_TIME=$(($SECONDS - $START_TIME))
echo "Done in $ELAPSED_TIME seconds!"
