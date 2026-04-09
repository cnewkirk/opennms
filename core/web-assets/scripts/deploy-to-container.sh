#!/usr/bin/env bash
# Deploy ALL compiled webpack assets to a running OpenNMS container.
# IMPORTANT: Always deploy all assets together — partial deploys cause webpack
# module ID mismatches that silently break JS across chunks (e.g., $ undefined).
#
# Usage:  ./scripts/deploy-to-container.sh [container-name]
#   Default container name: test-opennms

set -euo pipefail

CONTAINER=${1:-test-opennms}
ASSETS_SRC="$(cd "$(dirname "$0")/.." && pwd)/target/dist/assets"
ASSETS_DEST="/opt/opennms/jetty-webapps/opennms/assets"

if ! podman ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '${CONTAINER}' is not running" >&2
  exit 1
fi

if [ ! -f "${ASSETS_SRC}/assets.json" ]; then
  echo "ERROR: ${ASSETS_SRC}/assets.json not found — run 'npm run webpack' first" >&2
  exit 1
fi

echo "Deploying all assets to ${CONTAINER}:${ASSETS_DEST} ..."
podman cp "${ASSETS_SRC}/." "${CONTAINER}:${ASSETS_DEST}/"

# A dev build (npm run webpack) only writes assets.json, not assets.min.json.
# The server uses assets.min.json (minified=true by default), so we need to
# merge any entries that exist in assets.json but are missing from assets.min.json.
echo "Merging assets.json entries into assets.min.json ..."
MERGE_PY='
import json, os, sys
d = "/opt/opennms/jetty-webapps/opennms/assets"
full = json.load(open(os.path.join(d, "assets.json")))
mini = json.load(open(os.path.join(d, "assets.min.json")))
added = [k for k in full if k not in mini]
for k in added: mini[k] = full[k]
if added:
    json.dump(mini, open(os.path.join(d, "assets.min.json"), "w"), indent=4, sort_keys=True)
    print("  Added to assets.min.json:", ", ".join(sorted(added)))
else:
    print("  assets.min.json already up to date.")
'
podman exec "${CONTAINER}" python3 -c "${MERGE_PY}"

echo "Done. Hard-reload the browser to pick up new file versions."
