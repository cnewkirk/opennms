#!/usr/bin/env bash
# Deploy built UI assets to a running OpenNMS container.
# ALWAYS copies index.html + assets together — never one without the other.
# Usage: ./deploy-to-container.sh [container-name]
set -euo pipefail

CONTAINER="${1:-test-opennms}"
DIST_DIR="$(cd "$(dirname "$0")/src/main/dist" && pwd)"
DEST="/opt/opennms/jetty-webapps/opennms/ui"

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "ERROR: $DIST_DIR/index.html not found — run 'yarn build' first" >&2
  exit 1
fi

if ! podman inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q '^true$'; then
  echo "ERROR: container '$CONTAINER' is not running" >&2
  exit 1
fi

echo "Deploying to $CONTAINER..."

# Wipe stale assets first — podman cp only adds files, never removes them.
# Without this, every build accumulates orphaned hash-named chunks that waste
# disk space and can confuse debugging ("which CSS file is actually in use?").
podman exec "$CONTAINER" sh -c "rm -rf $DEST/assets && mkdir -p $DEST/assets"

podman cp "$DIST_DIR/assets/." "$CONTAINER:$DEST/assets/"
podman cp "$DIST_DIR/index.html" "$CONTAINER:$DEST/index.html"

# Verify the live index.html matches what we built
BUILT_BUNDLE=$(grep -o 'assets/index-[^"]*\.js' "$DIST_DIR/index.html")
LIVE_BUNDLE=$(podman exec "$CONTAINER" grep -o 'assets/index-[^"]*\.js' "$DEST/index.html")

if [[ "$BUILT_BUNDLE" != "$LIVE_BUNDLE" ]]; then
  echo "ERROR: index.html mismatch after copy!" >&2
  echo "  built: $BUILT_BUNDLE" >&2
  echo "  live:  $LIVE_BUNDLE" >&2
  exit 1
fi

echo "Done. Live bundle: $LIVE_BUNDLE"
