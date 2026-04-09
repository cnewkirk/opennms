# Local Development Setup

Complete guide for getting the OpenNMS UI development environment running from scratch.

---

## Prerequisites

Install all required tooling:

```bash
# Java 17 (required — enforcer rejects 11 or 23)
brew install openjdk@17
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home

# Docker runtime (colima)
brew install colima docker docker-buildx docker-compose
mkdir -p ~/.docker/cli-plugins
ln -sf /opt/homebrew/opt/docker-buildx/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
ln -sf /opt/homebrew/opt/docker-compose/bin/docker-compose ~/.docker/cli-plugins/docker-compose

# Podman (for test container lab)
brew install podman
podman machine init
podman machine set --rootful --memory 8192
podman machine start

# pnpm (for web-assets / Vue menu builds)
npm install -g pnpm
```

---

## Quick Start: UI Development (Test Container)

This is the primary workflow for UI work. Uses the released `35.0.4` base image with an overlay of local UI changes — much faster than a full Maven build.

### 1. Start Postgres

```bash
cd tools/local_development/postgres
docker compose up -d
```

### 2. Start colima with enough memory

OpenNMS needs at least 6–8 GB. The default 2 GB colima allocation causes an OOM kill.

```bash
colima start --memory 8 --cpu 4
# If already running with less memory:
colima stop && colima start --memory 8 --cpu 4
```

### 3. Build the test container image

```bash
./build-dark-mode-overlay.sh
```

This builds webpack assets, the Vue menu (vite), `opennms-webapp-rest`, then assembles an overlay on top of `opennms/horizon:35.0.4`. Result: `localhost/opennms/horizon:35.0.5-dark-mode`.

### 4. Start the container

```bash
podman rm -f test-opennms 2>/dev/null
podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms \
  -e OPENNMS_DBUSER=opennms \
  -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
```

### 5. Wait for startup, then set password

```bash
# Wait for ready
until curl -s -o /dev/null -w '%{http_code}' -u admin:admin \
  http://localhost:8980/opennms/rest/info | grep -q 200; do sleep 5; done
echo "ready"

# Set password to notdefault
podman exec test-opennms /opt/opennms/bin/password admin notdefault
```

### 6. Open

**http://localhost:8980/opennms** — login: `admin` / `notdefault`

---

## Topology Lab

Spins up a 5-node spine/leaf network (FRR OSPF + ISIS + LLDP + SNMP) for EnLinkd testing. Requires `test-opennms` to be running first.

```bash
./start-topology-lab.sh          # start (tears down + rebuilds if already running)
./start-topology-lab.sh --teardown   # teardown only
./start-topology-lab.sh --rebuild    # force topology-node image rebuild
```

After ~30–60s for EnLinkd collection: **http://localhost:8980/opennms/#/topology**

Verify layers:
```bash
podman exec topo-spine-01 vtysh -c "show ip ospf neighbor"   # OSPF
podman exec topo-spine-01 vtysh -c "show isis neighbor"      # ISIS
podman exec topo-spine-01 lldpcli show neighbors             # LLDP
```

---

## Full Source Build (rarely needed)

Only required when changing Java backend code. UI-only changes use the overlay workflow above.

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home

# 1. Build all Maven modules
./compile.pl -DskipTests install

# 2. Package assembly tarball
./assemble.pl -Dopennms.home=/opt/opennms -DskipTests

# 3. Build and load Docker image (use oci+install, not image — colima uses a non-default buildx builder)
cd opennms-container/core && make oci && make install
```

---

## Branches

| Branch | Purpose |
|--------|---------|
| `ui-refactor` | Full UI overhaul (topology panels, Perses dashboards, etc.) — was `feature/jmx-config-vue` |
| `develop` | Main branch |

---

## Troubleshooting

**OOM kill (exit 137 or exit 1 with `OutOfMemoryError: Java heap space`):** The podman machine needs at least 8 GB. Check with `podman machine inspect` — if Memory is 2048, run: `podman machine stop && podman machine set --memory 8192 && podman machine start`. Also ensure colima (used for Docker builds) has enough memory: `colima stop && colima start --memory 8 --cpu 4`.

**`make image` fails with buildx error:** Use `make oci && make install` instead. The `image` target requires a buildx builder named exactly `default`, which colima doesn't provide.

**npm `ETARGET` errors during Maven build:** The `package-lock.json` has stale pinned versions. Delete it and regenerate: `cd core/web-assets && rm package-lock.json && npm install`

**`podman: Cannot connect`:** Run `podman machine start`

**`docker buildx` not found:** `brew install docker-buildx && ln -sf /opt/homebrew/opt/docker-buildx/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx`
