#!/usr/bin/env bash
# stop-topology-lab.sh — Tears down the topology lab.
# Equivalent to: ./start-topology-lab.sh --teardown
set -euo pipefail
exec "$(dirname "$0")/start-topology-lab.sh" --teardown
