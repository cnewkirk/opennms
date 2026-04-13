# CLAUDE.md

## DO THE WORK — NO EXCEPTIONS

This is the #1 rule. Everything else is secondary.

- **When you change code, build and deploy it immediately.** Do not describe what the user should do. Do not say "now run X". Run it yourself. The change is not done until it is LIVE in the container.
- **When a service is stopped, start it.** When a container is down, bring it up. When a build is needed, run it. Never hand the user a command to run.
- **Trust the user's observations.** When they say something is broken, fix it — do not waste cycles reproducing what they already told you.
- **Do not ask permission for obvious next steps.** Build, deploy, verify, report. If the user says "fix X", that means fix it, deploy it, verify it works, and tell them to hard-refresh.
- **Do not brainstorm, propose options, or over-explain** when the path is clear. Just do it.
- **Fix things right the first time.** Read memories, project docs, and prior conversation before acting. Do not iterate through 3-4 broken attempts. Each rebuild cycle costs minutes and dollars.

## HARD RULES

### Session Start Protocol

**Before touching a single file**, run:
```bash
git log --oneline -10
git status
podman image inspect localhost/opennms/horizon:35.0.5-dark-mode --format '{{.Created}}' 2>/dev/null
podman ps --filter name=test-opennms --format '{{.Status}} {{.Image}}'
```
And read MEMORY.md. Every session starts blind — these steps give you context.

**Container freshness is NOT optional.** Compare the image `Created` date against `git log -1 --format='%ci' HEAD`. **If the image is more than 24 hours older than HEAD and the fix touches ANYTHING outside `ui/src/`** (JSPs, REST, Karaf features, backend jars, config XML, etc.), you **MUST** rebuild before trusting the container:
```bash
./build-dark-mode-overlay.sh                 # ~3-5 min
podman rm -f test-opennms && podman run -d --name test-opennms --privileged \
  -p 8980:8980 -p 8101:8101 \
  -e POSTGRES_HOST=host.containers.internal -e POSTGRES_PORT=5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e OPENNMS_DBNAME=opennms -e OPENNMS_DBUSER=opennms -e OPENNMS_DBPASS=opennms \
  localhost/opennms/horizon:35.0.5-dark-mode -s
# wait for /opennms/rest/info → 200, then set password to 'notdefault' via Jasypt
# (see tail of build-dark-mode-overlay.sh output for the exact Jasypt command)
cd ui && ./target/node/yarn/dist/bin/yarn build
./ui/deploy-to-container.sh test-opennms
```
**Hot-deploying the Vue SPA via `deploy-to-container.sh` does NOT update JSPs, jars, features, or `applicationContext-*.xml`.** Those only land in the container through a full `build-dark-mode-overlay.sh` → image → container recreate cycle. Treating a stale container as current has caused multiple failed-fix loops that wasted hours and money. If in doubt, rebuild.

**NEVER make sweeping "cleanup" commits** touching multiple unrelated files without understanding each one. The commit `c223dcdae54 ui redesign cleanup` (2026-04-10) wiped multiple prior fixes because the session didn't read context first. If something looks wrong, check `git log --oneline -5 -- <file>` before changing it.

**`git reset --hard` is COMPLETELY BANNED. No exceptions. No "just this once". No "but there's nothing uncommitted".** There is no scenario where this command is acceptable. Use `git revert` to undo a commit. Use `git stash` to set aside work. If you think you need `git reset --hard`, you are wrong — ask the user instead. The April 10 incident lost 15 commits and caused menu regressions that took 4 sessions to fully fix because resets wiped uncommitted changes that were invisible to every subsequent session.

**Never reset to a remote branch** (`git reset --hard fork/feat/ui-refactor` or similar). If local and remote have diverged, that divergence is intentional. Never "sync" by overwriting local.

### Git Hygiene

1. **NEVER commit to `master`, `develop`, or any upstream branch.** All work goes on `feature/*` or `feat/*` branches.
2. **Push ONLY to `fork` remote** (cnewkirk/opennms). Never push to `origin`.
3. **NEVER open PRs against OpenNMS/opennms** without the user explicitly typing "OpenNMS/opennms" in their message. PRs are opened on `cnewkirk/opennms` (fork-to-fork). Unauthorized upstream PRs are irreversible and cause public embarrassment.
4. **Never add Co-Authored-By Claude or credit Claude on commits/PRs.** Never commit Claude-specific files to the repo.
5. **Squash iterative commits** into logical groups before pushing. Maintainers don't want to see the sausage being made.
6. **Git identity:** `Chance Newkirk <chance.newkirk+github@pm.me>`

### UI Build & Deploy (for any change under `ui/src/`)

Every UI change MUST follow this exact sequence — no shortcuts, no skipping steps:

**Bootstrap (fresh clone only):** `ui/target/node/` does not exist until Maven has run. Bootstrap once with:
```bash
cd ui && mvn install -DskipTests -Prun-npm
```
This downloads the correct Node and Yarn versions into `ui/target/node/`.

1. `cd ui && ./target/node/yarn/dist/bin/yarn build`
   - **NEVER use `npm run build`** — it writes to `ui/dist/` which the deploy script does NOT read. Silent failure.
   - Run from the repo root `ui/` directory. The yarn binary lives in `target/node/` (downloaded by Maven).
2. Verify `ui/src/main/dist/index.html` has `src="/opennms/ui/assets/index-*.js"` paths
3. Verify built CSS has no bare `--feather-*` values (must be wrapped in `var()`)
4. `./ui/deploy-to-container.sh test-opennms` (if container is stopped, START IT FIRST)
   - The script now **wipes the assets directory before copying** to prevent stale chunk accumulation. Without this, every build leaves orphaned hash-named CSS/JS files that make it impossible to know which file is actually in use. If you ever see a container with many `Dashboard-*.css` files from different builds, the container predates this fix — recreate it.
5. Verify live bundle hash matches built hash:
   - `podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html`
   - `grep -o 'assets/index-[^"]*\.js' ui/src/main/dist/index.html`
   - Both MUST match.
6. `curl -s -o /dev/null -w "%{http_code}" -L http://localhost:8980/opennms/ui/assets/index-*.js` → must be 200
7. Tell user to hard refresh (`Cmd+Option+R` in Safari, Shift+click reload in Chrome)

**Never claim something is fixed without completing ALL steps above.**

### Containers & Podman

- **Always use `--privileged`** with podman on macOS. JVM gets "Operation not permitted" without it.
- **Container startup takes ~15-20 seconds.** Cap health-check polling at 12 iterations x 5s = 60s. If not ready, check logs and fail. Never wait 5-10 minutes.
- **Use HTTP health checks**, not `opennms status` (unreliable in containers).
- **Verify overlay images before starting containers.** After `podman build`, spot-check critical files. Treat build warnings as errors.
- **NEVER run OpenNMS natively on macOS** — always use container overlay testing.
- **Set test container password to `notdefault` via Jasypt** (SHA-256, iterations=100000, saltSizeBytes=16). Never PUT plaintext passwords to REST API.
- **JSP changes need full container rebuild+restart** — `podman cp` does NOT trigger JSP recompilation.

### Testing & Verification

- **E2E tests against live test harness are MANDATORY before any git push.** No exceptions.
- **Never claim something works without proof.** Show actual output — HTTP codes, test results, live verification.
- **Never remove code outside current task scope.** Fix it or leave it alone.

## Project Overview

OpenNMS Horizon — open-source enterprise network monitoring. Version 35.x, Java 17, Maven multi-module (~500+ submodules). AGPL v3.

## Build Commands

Ships its own Maven in `maven/bin/mvn`. `compile.pl` and `assemble.pl` wrappers handle Java/Maven detection.

```bash
# Full build (skip tests, ~15-30 min first time)
./compile.pl -DskipTests

# Assemble into runnable target directory
./assemble.pl -p dir -DskipTests

# Single module + deps
./compile.pl -DskipTests --projects :opennms-dao -am install

# Downstream dependents
./compile.pl -t --projects :opennms-dao -amd install

# Single test class (cd into module first)
cd features/timeseries && ../../maven/bin/mvn test -Dtest=RingBufferTimeseriesWriterTest

# License validation (CI tarball)
./compile.pl -DskipTests -Denable.license=true -Passemblies -Psmoke install
```

## Architecture

### Module Structure

- **`core/`** — Shared libraries (API, IPC, SNMP, Spring, DB schema, web assets)
- **`features/`** — Plugins (timeseries, flows, alarms, collection, discovery, events, topology, Kafka/ES)
- **`opennms-dao/`** / **`opennms-dao-api/`** — Data access (Hibernate/PostgreSQL)
- **`opennms-model/`** — Domain model (nodes, events, alarms)
- **`opennms-services/`** — Core daemons (pollerd, collectd, eventd)
- **`opennms-config*/`** — Config model, JAXB, DAO for XML configs
- **`container/`** — Karaf OSGi container (features XML, assembly, Spring↔Karaf bridge)
- **`opennms-full-assembly/`** — Final Horizon assembly
- **`smoke-test/`** — Selenium smoke tests (Testcontainers, `*IT.java`)

### Karaf/OSGi

OpenNMS predates Karaf. Web UI + Spring Security are traditional Spring context; Karaf is embedded above.

**Adding a new Karaf feature requires 3 places:**
1. Feature definition in `container/features/src/main/resources/features*.xml`
2. `featuresBoot` entry in the corresponding `.cfg` file
3. `<bootFeatures>` section in `container/karaf/pom.xml`

Key gotchas:
- `<bundle dependency="true">` = "skip if packages already exported" (NOT "required dependency")
- `prerequisite="true"` = force parent to fully load before this feature
- OSGi resolution errors in `karaf.log`: read `Unable to resolve root:` chains backwards

### IPC (3 patterns, each with JMS/Kafka/gRPC impls)

- **RPC** — Request/response to Minions
- **Sink** — One-way from Minions to Horizon
- **Twin** — Config sync Horizon→Minions

### Timeseries

`features/timeseries/` — TSS integration layer, `RingBufferTimeseriesWriter`. Plugins implement `TimeSeriesStorage`.

## Branch Strategy

- **`develop`** — Next major release
- **`release-XX.x`** — Stable releases
- CI auto-merges: `foundation-2024` → `release-33.x` → `develop`
- Tags: `opennms-XX.X.X-1`

## Code Quality

- **Checkstyle** (`src/main/resources/nms_checks.xml`): `StandardCharsets.UTF_8` not string literals, `MoreObjects.toStringHelper()` not Spring's
- **CI (CircleCI):** Dynamic config auto-detects changes. Force paths via commit keywords: `!build-deploy`, `!smoke`, `!oci`, `!doc`, `!ui`

## Key Conventions

- Maven Enforcer blocks banned/duplicate deps — fix with `<exclusions>`
- Custom Spring/Security forks (patched 4.2.x)
- Apache Servicemix wrappers for OSGi
- Artifact IDs without groupId if unique: `--projects :opennms-dao`
