#!/usr/bin/env bash
#
# Build a distributable plugin zip that honors .distignore.
#
# wp-scripts plugin-zip ignores .distignore (it uses either the package.json
# `files` field via npm-packlist — which force-adds README.md/package.json — or
# a fixed glob that misses assets/ and block/). This script stages a clean copy
# with rsync using .distignore as the exclude list, then zips it, so the archive
# contains exactly the runtime files and nothing dev-only.
#
# Usage: npm run plugin-zip   (from the plugin root)

set -euo pipefail

cd "$( dirname "$0" )/.."

SLUG="teamgraph"
STAGE=".dist-tmp"
OUT="${SLUG}.zip"

# Build fresh assets so the zip never ships stale bundles.
npm run build

rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/$SLUG"

# .distignore drives the excludes; also drop VCS and this staging dir.
rsync -a \
	--exclude-from=.distignore \
	--exclude=".git/" \
	--exclude="$STAGE" \
	--exclude="$OUT" \
	./ "$STAGE/$SLUG/"

( cd "$STAGE" && zip -qr "../$OUT" "$SLUG" )
rm -rf "$STAGE"

echo "Created $OUT"
