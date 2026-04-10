# API Tokens Feature — Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found during code review of the API tokens feature (`feature/api-tokens` branch) to bring it in line with OpenNMS codebase standards before submitting an upstream PR.

**Architecture:** The API tokens feature spans `features/api-tokens/` (api/impl/shell modules), `features/springframework-security/` (auth filter), `opennms-webapp-rest/` (REST endpoint), `opennms-webapp/` (JSP pages), `opennms-container/` (container overlay menus), `ui/` (Vue menu component), and several menu JSON files. All changes target the existing `feature/api-tokens` branch and will be squashed into a single commit before push.

**Tech Stack:** Java 17, Maven, JPA 2.0 (Hibernate), Spring Security (XML config), JAX-RS, Liquibase, Karaf/OSGi, Vue 3, JSP/Bootstrap

**Branch:** `feature/api-tokens` (on `cnewkirk/opennms` fork)

**Important context:**
- The branch already has one squashed commit (`fd6c0dd8279`) with all the feature code
- There are also uncommitted local changes to Vue component and 4 menu JSON files — these contain unwanted whitespace reformatting that must be discarded
- After all fixes, everything gets squashed into one clean commit
- Never push without explicit user approval
- Never add Co-Authored-By Claude or credit Claude on commits

---

## File Map

Files touched by this plan, grouped by task:

| Task | File | Action |
|------|------|--------|
| 1 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiToken.java` | Add license header |
| 1 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenDao.java` | Add license header |
| 1 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenService.java` | Add license header |
| 1 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenCreateRequest.java` | Add license header |
| 1 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenCreateResponse.java` | Add license header |
| 1 | `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenDaoHibernate.java` | Add license header |
| 1 | `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenServiceImpl.java` | Add license header |
| 1 | `features/api-tokens/impl/src/test/java/org/opennms/features/apitokens/impl/ApiTokenServiceImplTest.java` | Add license header |
| 1 | `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenGenerateCommand.java` | Add license header |
| 1 | `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenListCommand.java` | Add license header |
| 1 | `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenRevokeCommand.java` | Add license header |
| 1 | `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenRevokeAllCommand.java` | Add license header |
| 1 | `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ApiTokenRestService.java` | Add license header |
| 2 | `opennms-webapp/src/main/webapp/WEB-INF/applicationContext-spring-security.xml` | Add intercept-url rules |
| 3 | All 4 `menu-template*.json` under `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/` | Discard whitespace, add only apiTokens entry |
| 3 | `opennms-webapp-rest/src/test/resources/menu/menu-template.json` | Add apiTokens entry |
| 3 | All 4 `menu-template*.json` under `opennms-container/core/tarball-root/.../WEB-INF/menu/` | Add apiTokens entry |
| 3 | `ui/src/components/Menu/UserSelfServiceMenuItem.vue` | Already correct, just needs to be staged |
| 4 | `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenDao.java` | Change LegacyOnmsDao → OnmsDao |
| 4 | `features/api-tokens/api/pom.xml` | Add `<scope>provided</scope>` to opennms-dao-api dep |
| 5 | `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenServiceImpl.java` | Add description length validation |
| 5 | `features/api-tokens/impl/src/test/java/org/opennms/features/apitokens/impl/ApiTokenServiceImplTest.java` | Add test for description validation |
| 6 | `opennms-webapp/src/main/webapp/admin/userGroupView/users/apiTokens.jsp` | XSS fix: WebSecurityUtils.sanitizeString |
| 7 | `opennms-webapp/src/main/webapp/account/selfService/index.jsp` | Update stale description text |
| 7 | `features/api-tokens/impl/src/main/resources/META-INF/opennms/component-dao.xml` | Add onmsgi:service for DAO |
| 7 | `container/karaf/src/main/filtered-resources/etc/org.apache.karaf.features.cfg` | Fix formatting (space before backslash) |

---

## Task 1: Add AGPL License Headers to All Java Files

Every Java file in the project must have the AGPL v3 license header. CI enforces this via `license-maven-plugin` (`-Denable.license=true`). All 13 Java files in the feature are missing it.

**Files (all need the same header prepended before the `package` line):**
- `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiToken.java`
- `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenDao.java`
- `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenService.java`
- `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenCreateRequest.java`
- `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenCreateResponse.java`
- `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenDaoHibernate.java`
- `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenServiceImpl.java`
- `features/api-tokens/impl/src/test/java/org/opennms/features/apitokens/impl/ApiTokenServiceImplTest.java`
- `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenGenerateCommand.java`
- `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenListCommand.java`
- `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenRevokeCommand.java`
- `features/api-tokens/shell/src/main/java/org/opennms/features/apitokens/shell/ApiTokenRevokeAllCommand.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ApiTokenRestService.java`

The `ApiTokenAuthenticationFilter.java` and `ApiTokenAuthenticationFilterTest.java` in `features/springframework-security/` already have the header — they are in an existing module whose build added it automatically.

- [ ] **Step 1: Add the license header to each file**

The header to prepend before `package ...;` in every file listed above:

```java
/*
 * Licensed to The OpenNMS Group, Inc (TOG) under one or more
 * contributor license agreements.  See the LICENSE.md file
 * distributed with this work for additional information
 * regarding copyright ownership.
 *
 * TOG licenses this file to You under the GNU Affero General
 * Public License Version 3 (the "License") or (at your option)
 * any later version.  You may not use this file except in
 * compliance with the License.  You may obtain a copy of the
 * License at:
 *
 *      https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
```

For each file, the edit is: find `package org.opennms...` on line 1 and insert the header block above it.

- [ ] **Step 2: Verify headers match existing files**

Spot-check against a known-good file:

```bash
head -22 features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiToken.java
head -22 features/scv/shell/src/main/java/org/opennms/features/scv/shell/ScvGetCommand.java
```

Confirm the first 21 lines (the `/* ... */` block) are identical.

- [ ] **Step 3: Commit**

```bash
git add features/api-tokens/ opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/ApiTokenRestService.java
git commit -m "fix: add AGPL license headers to all API tokens Java files"
```

---

## Task 2: Add Spring Security intercept-url Rules for API Token Endpoints

**Problem:** The `/api/v2/**` http block in Spring Security restricts POST and DELETE to `ROLE_REST,ROLE_ADMIN`. Regular users with only `ROLE_USER` get 403 when trying to create or revoke their own tokens. The REST service has its own authorization logic, but Spring Security rejects the request before it reaches the endpoint.

**File:** `opennms-webapp/src/main/webapp/WEB-INF/applicationContext-spring-security.xml`

- [ ] **Step 1: Add intercept-url rules**

Find the `/api/v2/**` http block. After the existing graphs rules (line 171) and before the geocoding rules (line 173), add:

```xml
    <!-- Allow authenticated users to manage their own API tokens -->
    <intercept-url pattern="/api/v2/api-tokens" method="GET" access="ROLE_REST,ROLE_ADMIN,ROLE_USER"/>
    <intercept-url pattern="/api/v2/api-tokens" method="POST" access="ROLE_REST,ROLE_ADMIN,ROLE_USER"/>
    <intercept-url pattern="/api/v2/api-tokens" method="DELETE" access="ROLE_REST,ROLE_ADMIN,ROLE_USER"/>
    <intercept-url pattern="/api/v2/api-tokens/**" method="GET" access="ROLE_REST,ROLE_ADMIN,ROLE_USER"/>
    <intercept-url pattern="/api/v2/api-tokens/**" method="DELETE" access="ROLE_REST,ROLE_ADMIN,ROLE_USER"/>
```

The exact insertion point is after line 171 (`<intercept-url pattern="/api/v2/graphs/**" method="POST" .../>`) and before line 173 (`<!-- Only allow privileged users to access geocoding API -->`).

These rules are evaluated before the catch-all `/api/v2/**` rules at lines 183-189. Spring Security's `<http>` element evaluates intercept-url patterns in document order, and the first match wins.

**Why both `/api/v2/api-tokens` and `/api/v2/api-tokens/**`:** The "revoke all" endpoint is `DELETE /api/v2/api-tokens?username=foo` (no path segment after `api-tokens`), so it matches the non-wildcarded pattern. The "revoke one" endpoint is `DELETE /api/v2/api-tokens/{id}`, which matches the `/**` pattern.

- [ ] **Step 2: Verify the change compiles (XML is well-formed)**

```bash
xmllint --noout opennms-webapp/src/main/webapp/WEB-INF/applicationContext-spring-security.xml
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp/src/main/webapp/WEB-INF/applicationContext-spring-security.xml
git commit -m "fix: add Spring Security intercept-url rules allowing ROLE_USER to manage API tokens"
```

---

## Task 3: Fix Menu JSON Files — Revert Whitespace, Add apiTokens to All Copies

**Problem:** The uncommitted menu JSON changes contain extensive whitespace reformatting (single-line arrays expanded to multi-line, indent fixes) that is not part of the feature. This pollutes `git blame` and creates merge conflicts. Additionally, the test resources copy and all 4 container overlay copies are missing the `apiTokens` entry entirely.

### Step 3a: Discard all uncommitted menu JSON changes

- [ ] **Discard the whitespace-reformatted menu JSONs**

```bash
git checkout -- opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json
git checkout -- opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json
git checkout -- opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-alt.json
git checkout -- opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-legacy.json
```

This resets them to the committed state on `feature/api-tokens` (which has no apiTokens entry — it wasn't in the original commit).

### Step 3b: Add ONLY the apiTokens entry to all 9 menu JSON files

Each of these 9 files has a `selfServiceMenu.items` array containing `changePassword` and `logout` entries. The `apiTokens` entry must be inserted between them.

**Files:**
1. `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json`
2. `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json`
3. `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-alt.json`
4. `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-legacy.json`
5. `opennms-webapp-rest/src/test/resources/menu/menu-template.json`
6. `opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template.json`
7. `opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-default.json`
8. `opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-alt.json`
9. `opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-legacy.json`

- [ ] **In each file, find the `selfServiceMenu` items array and add the `apiTokens` entry**

In each file, find this exact JSON pattern inside the `selfServiceMenu.items` array:

```json
      {
        "id": "changePassword",
        ...
      },
      {
        "id": "logout",
```

Insert the following block between the `changePassword` entry's closing `},` and the `logout` entry's opening `{`:

```json
      {
        "id": "apiTokens",
        "name": "API Tokens",
        "url": "account/selfService/apiTokens.jsp",
        "locationMatch": null,
        "roles": null
      },
```

**Important:** Match the existing indentation exactly. Do NOT reformat any other lines. The diff for each file should show ONLY the 7 added lines for the `apiTokens` entry. If your editor reformats the file, revert and use a targeted edit tool instead.

- [ ] **Verify the JSON is valid in every file**

```bash
for f in \
  opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json \
  opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-default.json \
  opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-alt.json \
  opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template-legacy.json \
  opennms-webapp-rest/src/test/resources/menu/menu-template.json \
  opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template.json \
  opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-default.json \
  opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-alt.json \
  opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/menu-template-legacy.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done
```

- [ ] **Verify each diff is minimal (only the apiTokens block)**

```bash
git diff --stat -- '**/menu-template*.json'
```

Each file should show ~7 lines added, 0 deleted. If any file shows more, the whitespace reformat leaked in — re-check.

### Step 3c: Ensure the Vue component change is staged

The Vue component change (`ui/src/components/Menu/UserSelfServiceMenuItem.vue`) was already correct from the previous session. Verify it's still correct and stage it.

- [ ] **Verify the Vue diff is minimal**

```bash
git diff ui/src/components/Menu/UserSelfServiceMenuItem.vue
```

Expected diff: +1 import line (`IconApiEndpoints`), +1 computed line (`apiTokensMenu`), +1 in the return array, +2 in the icon switch case. If it shows more, investigate.

- [ ] **Commit**

```bash
git add opennms-webapp-rest/src/main/webapp/WEB-INF/menu/ \
        opennms-webapp-rest/src/test/resources/menu/ \
        opennms-container/core/tarball-root/jetty-webapps/opennms/WEB-INF/menu/ \
        ui/src/components/Menu/UserSelfServiceMenuItem.vue
git commit -m "feat: add API Tokens to user dropdown menu in all menu templates and Vue component"
```

---

## Task 4: Replace LegacyOnmsDao with OnmsDao + Fix Dependency Scope

**Problem:** `ApiTokenDao` extends `LegacyOnmsDao<ApiToken, Integer>`. The `LegacyOnmsDao` interface is explicitly `@Deprecated` and only exists for backward compatibility. All new DAOs use `OnmsDao` directly. Additionally, the `opennms-dao-api` dependency in the API module should be `<scope>provided</scope>` since the API module only needs it at compile time.

`AbstractDaoHibernate` (the base class for `ApiTokenDaoHibernate`) already implements `OnmsDao`, not `LegacyOnmsDao`. So the DAO implementation class needs no changes.

**Files:**
- Modify: `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenDao.java`
- Modify: `features/api-tokens/api/pom.xml`

- [ ] **Step 1: Change the DAO interface**

In `features/api-tokens/api/src/main/java/org/opennms/features/apitokens/ApiTokenDao.java`, change:

```java
import org.opennms.netmgt.dao.api.LegacyOnmsDao;

public interface ApiTokenDao extends LegacyOnmsDao<ApiToken, Integer> {
```

To:

```java
import org.opennms.netmgt.dao.api.OnmsDao;

public interface ApiTokenDao extends OnmsDao<ApiToken, Integer> {
```

- [ ] **Step 2: Add `<scope>provided</scope>` to opennms-dao-api dependency**

In `features/api-tokens/api/pom.xml`, change:

```xml
        <dependency>
            <groupId>org.opennms</groupId>
            <artifactId>opennms-dao-api</artifactId>
        </dependency>
```

To:

```xml
        <dependency>
            <groupId>org.opennms</groupId>
            <artifactId>opennms-dao-api</artifactId>
            <scope>provided</scope>
        </dependency>
```

- [ ] **Step 3: Verify compilation**

```bash
./compile.pl -DskipTests --projects :org.opennms.features.api-tokens.api,:org.opennms.features.api-tokens.impl -am install
```

Expected: BUILD SUCCESS. If there are compile errors related to `OnmsDao` vs `LegacyOnmsDao`, check that `AbstractDaoHibernate<ApiToken, Integer>` satisfies all methods of `OnmsDao<ApiToken, Integer>` (it does — confirmed by reading the source).

- [ ] **Step 4: Commit**

```bash
git add features/api-tokens/api/
git commit -m "fix: replace deprecated LegacyOnmsDao with OnmsDao and set dependency scope to provided"
```

---

## Task 5: Add Description Length Validation

**Problem:** The `ApiToken.description` column is `length = 256` in the JPA annotation, but no validation prevents longer input. A description exceeding 256 characters hits a database truncation error (ugly 500) instead of a clean 400.

**Files:**
- Modify: `features/api-tokens/impl/src/main/java/org/opennms/features/apitokens/impl/ApiTokenServiceImpl.java`
- Modify: `features/api-tokens/impl/src/test/java/org/opennms/features/apitokens/impl/ApiTokenServiceImplTest.java`

- [ ] **Step 1: Write the failing test**

Add this test to `ApiTokenServiceImplTest.java` after the existing `testCreateTokenRejectsWhenMaxTokensReached` test:

```java
    @Test(expected = IllegalArgumentException.class)
    public void testCreateTokenRejectsLongDescription() {
        when(mockDao.countByUsername("admin")).thenReturn(0);
        String longDesc = "a".repeat(257);
        service.createToken("admin", longDesc, 30);
    }
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
./compile.pl -T org.opennms.features.apitokens.impl.ApiTokenServiceImplTest --projects :org.opennms.features.api-tokens.impl install
```

Expected: FAIL — `testCreateTokenRejectsLongDescription` throws no exception (the service currently accepts any length).

- [ ] **Step 3: Add the validation**

In `ApiTokenServiceImpl.java`, in the `createToken` method, add this check after the `days <= 0` check (after line 76) and before the `// Generate token` comment (line 78):

```java
        if (description != null && description.length() > 256) {
            throw new IllegalArgumentException("Description must be 256 characters or less");
        }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
./compile.pl -T org.opennms.features.apitokens.impl.ApiTokenServiceImplTest --projects :org.opennms.features.api-tokens.impl install
```

Expected: All 9 tests PASS (8 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add features/api-tokens/impl/
git commit -m "fix: validate description length before persisting API token"
```

---

## Task 6: Fix XSS in Admin API Tokens JSP

**Problem:** The admin JSP uses `Util.encode()` (URL encoding) on `userID`, then outputs it with `<%= userID %>`. URL encoding is NOT HTML encoding. A crafted `userID` could contain characters that are safe in URLs but dangerous in HTML. The existing `userDetail.jsp` uses `WebSecurityUtils.sanitizeString()` for this purpose.

**File:** `opennms-webapp/src/main/webapp/admin/userGroupView/users/apiTokens.jsp`

- [ ] **Step 1: Add the WebSecurityUtils import**

On line 24, the page directive is:

```jsp
<%@page language="java" contentType="text/html" session="true"
    import="org.opennms.web.api.Util,
            org.opennms.web.utils.Bootstrap"
%>
```

Change to:

```jsp
<%@page language="java" contentType="text/html" session="true"
    import="org.opennms.web.api.Util,
            org.opennms.core.utils.WebSecurityUtils,
            org.opennms.web.utils.Bootstrap"
%>
```

- [ ] **Step 2: Sanitize the `userID` for HTML output**

After line 34 (`userID = org.opennms.web.api.Util.encode(userID);`), add:

```jsp
    String safeUserID = WebSecurityUtils.sanitizeString(userID);
```

- [ ] **Step 3: Replace `<%= userID %>` with `<%= safeUserID %>` in the card header**

On line 51, change:

```jsp
        <span>API Tokens for user: <%= userID %></span>
```

To:

```jsp
        <span>API Tokens for user: <%= safeUserID %></span>
```

- [ ] **Step 4: Sanitize the JavaScript variable too**

On line 104, change:

```jsp
var targetUser = '<%= userID %>';
```

To:

```jsp
var targetUser = '<%= safeUserID %>';
```

Note: `userID` (URL-encoded) is still used in the breadcrumb URLs where URL encoding is appropriate. `safeUserID` (HTML-sanitized) is used only for display in HTML and JavaScript string contexts.

- [ ] **Step 5: Commit**

```bash
git add opennms-webapp/src/main/webapp/admin/userGroupView/users/apiTokens.jsp
git commit -m "fix: use WebSecurityUtils.sanitizeString for userID display in admin API tokens JSP"
```

---

## Task 7: Remaining Minor Fixes

Three small fixes that can be done together.

### 7a: Update stale self-service index.jsp description

**File:** `opennms-webapp/src/main/webapp/account/selfService/index.jsp`

- [ ] **Change the description text**

On lines 95-96, change:

```
         Currently, account self-service is limited to password changes. Note that in environments using a
         reduced sign-on system such as LDAP, changing your password here may have no effect and may not even be
         possible.
```

To:

```
         Account self-service options include password changes and API token management. Note that in environments
         using a reduced sign-on system such as LDAP, changing your password here may have no effect and may not
         even be possible.
```

### 7b: Add onmsgi:service export for ApiTokenDao

**File:** `features/api-tokens/impl/src/main/resources/META-INF/opennms/component-dao.xml`

The standard pattern (see `features/enlinkd/persistence/impl/src/main/resources/META-INF/opennms/component-dao.xml`) exports each DAO as an OSGi service.

- [ ] **Add the DAO export**

After line 11 (`</bean>` closing the `apiTokenDao` bean), add:

```xml

    <onmsgi:service ref="apiTokenDao" interface="org.opennms.features.apitokens.ApiTokenDao"/>
```

So the section becomes:

```xml
    <bean id="apiTokenDao" class="org.opennms.features.apitokens.impl.ApiTokenDaoHibernate">
        <property name="sessionFactory" ref="sessionFactory"/>
    </bean>

    <onmsgi:service ref="apiTokenDao" interface="org.opennms.features.apitokens.ApiTokenDao"/>

    <bean id="apiTokenService" class="org.opennms.features.apitokens.impl.ApiTokenServiceImpl">
```

### 7c: Fix features.cfg formatting

**File:** `container/karaf/src/main/filtered-resources/etc/org.apache.karaf.features.cfg`

- [ ] **Add missing space before backslash**

On line 133, change:

```
  opennms-api-tokens,\
```

To:

```
  opennms-api-tokens, \
```

(Add a space before the backslash to match the formatting of all other lines in the list.)

- [ ] **Commit all three**

```bash
git add opennms-webapp/src/main/webapp/account/selfService/index.jsp \
        features/api-tokens/impl/src/main/resources/META-INF/opennms/component-dao.xml \
        container/karaf/src/main/filtered-resources/etc/org.apache.karaf.features.cfg
git commit -m "fix: update self-service description, export DAO as OSGi service, fix features.cfg formatting"
```

---

## Task 8: Build Verification

- [ ] **Build the affected modules**

```bash
./compile.pl -DskipTests --projects \
  :org.opennms.features.api-tokens.api,\
  :org.opennms.features.api-tokens.impl,\
  :org.opennms.features.api-tokens.shell,\
  :org.opennms.features.springframework-security,\
  :opennms-webapp-rest \
  -am install
```

Expected: BUILD SUCCESS.

- [ ] **Run all API tokens tests**

```bash
./compile.pl -t --projects :org.opennms.features.api-tokens.impl,:org.opennms.features.springframework-security install
```

Expected: All tests pass (9 service tests + 5 filter tests).

- [ ] **Verify no untracked or unstaged changes remain**

```bash
git status
git diff
```

Expected: clean working tree on `feature/api-tokens`, with 7 new commits from this plan.

---

## Post-Plan: Squash and Push (User-Directed)

**Do NOT execute this section automatically.** Wait for explicit user approval.

After all tasks pass, the user may want to squash all commits into a single clean commit:

```bash
# Interactive rebase is not supported in agentic context.
# Instead, soft-reset back to the parent of the original feature commit and re-commit:
git log --oneline feature/api-tokens | head -10  # verify commit history
git reset --soft <parent-of-fd6c0dd8279>
GIT_COMMITTER_NAME="Chance Newkirk" GIT_COMMITTER_EMAIL="chance.newkirk+github@pm.me" \
  git commit --author="Chance Newkirk <chance.newkirk+github@pm.me>" \
  -m "feat: add API token authentication for REST API access"
```

Push only when the user says QA is good:

```bash
git push fork feature/api-tokens --force-with-lease
```
