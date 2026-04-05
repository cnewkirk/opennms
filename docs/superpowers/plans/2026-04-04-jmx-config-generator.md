# JMX Config Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vaadin JMX Config Generator with a Vue 3 wizard backed by three new JAX-RS endpoints, and redirect the OpenNMS landing page to the Vue dashboard.

**Architecture:** New `JmxConfigResource` in `opennms-webapp-rest` exposes three endpoints (`/rest/jmx-config/detect`, `/rest/jmx-config/detect/{jobId}`, `/rest/jmx-config/generate`). Detection runs async via `JmxDetectJobManager` (ConcurrentHashMap + thread pool). Vue wizard has 4 steps: ConnectionForm → MBeanDetection (polling) → MBeanTree → ReviewSave. All menu and JSP redirects updated to point to the Vue route.

**Tech Stack:** Java 17, JAX-RS (CXF), Spring `@Component`, Jackson, JaxbUtils, `JmxDatacollectionConfiggenerator`, `DefaultJmxConnector`; Vue 3, Pinia, Feather DS, TypeScript, Axios.

**Scope note:** Phase 2a handles regular `Attrib` only (not `CompAttrib`/composite members) to keep the API surface manageable. Composite attribute support is a follow-up.

---

## Debugging Notes (2026-04-05)

### Container overlay testing: classloading for jmxconfiggenerator

The `jmxconfiggenerator` library jar must be in `/opt/opennms/lib/` (the Bootstrap server classpath).
It is NOT sufficient to put it in `WEB-INF/lib/`. Jetty's `WebAppClassLoader` treats `org.opennms.*`
as server classes and delegates to the parent (Bootstrap) classloader first. Since the Bootstrap
classpath is fixed when PID 1 starts, adding the jar requires a **full container stop+start**, NOT
just `opennms restart` (which only restarts the child JVM, not the Bootstrap).

Steps to deploy the jar to a running test container:
```bash
podman exec test-opennms cp \
  /opt/opennms/system/org/opennms/features/jmxconfiggenerator/35.0.4/jmxconfiggenerator-35.0.4.jar \
  /opt/opennms/lib/jmxconfiggenerator-35.0.4.jar
podman stop test-opennms && podman start test-opennms
```

This must be baked into the overlay image (`build-dark-mode-overlay.sh`) permanently — do not
rely on manual jar injection for repeated testing.

### Hot-deploying opennms-webapp-rest.jar

`opennms restart` does NOT reload WEB-INF/lib jars if the jar classes are cached by a parent classloader.
To pick up changes to `JmxDetectJob`, `JmxDetectJobManager`, or `JmxConfigResource`:
```bash
podman cp .../opennms-webapp-rest-35.0.4.jar test-opennms:/opt/opennms/jetty-webapps/opennms/WEB-INF/lib/
# Then FULL container restart:
podman stop test-opennms && podman start test-opennms
```
Wait for ready: `until curl -s -o /dev/null -w '%{http_code}' -u admin:admin http://localhost:8980/opennms/rest/info | grep -q 200; do sleep 5; done && echo ready`

### JMX connection URL for the test container

The `jmx-config.xml` says port 18980 — this port does NOT listen in the overlay container.
OpenNMS in this container exposes Karaf JMX on loopback only:
- RMI Registry: `127.0.0.1:1099`
- RMI Connector: `127.0.0.1:44444`
- Karaf instance name: `opennms` (from `etc/system.properties: karaf.name = opennms`)
- Full URL: `service:jmx:rmi://127.0.0.1:44444/jndi/rmi://127.0.0.1:1099/karaf-opennms`
- Auth: username=`admin`, password=`admin` (Karaf JAAS realm)

This is the only JMX endpoint available for self-testing in the container.

### JMX detection hangs on Karaf MBean server

The Karaf MBean server has hundreds of MBeans. `generateJmxConfigModel` blocks without a timeout.
Detection jobs never complete (status stays RUNNING indefinitely).

**Fix committed:** `JmxDetectJob` now wraps the blocking detection call in an inner thread with
`Future.get(120, TimeUnit.SECONDS)`. After 120s the job transitions to ERROR with a clear message.

**Status:** Fix committed, jar rebuilt, but `opennms restart` does NOT reload WEB-INF/lib jars
(parent classloader cache). Full container restart required to test.

### Bean override warning

`applicationContext-cxf-rest-v2.xml` has an explicit `<bean id="jmxDetectJobManager">` declaration
added as a debug fallback. This causes a Spring "Overriding bean definition" WARN at startup because
`@Component` scan also picks it up. The explicit XML bean wins. Since the fix is confirmed working
(component-scan picks it up correctly), **remove the explicit XML bean declaration** in the next
cleanup commit to eliminate the noise.

### TODO before this branch is PR-ready

- [ ] Remove explicit `<bean id="jmxDetectJobManager">` from `applicationContext-cxf-rest-v2.xml`
- [ ] Bake `jmxconfiggenerator-35.0.4.jar` into the overlay image script
- [ ] Full E2E test of the wizard after a clean container restart with all fixes in place
- [ ] Test generate endpoint (`POST /api/v2/jmx-config/generate`) end-to-end
- [ ] Test overwrite conflict flow in ReviewSave step

---

## File Map

**Create (Java):**
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/DetectRequest.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/MBeanAttributeDto.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/MBeanDto.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/DetectJobStatus.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/GenerateRequest.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/GenerateResponse.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJob.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManager.java`
- `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/JmxConfigResource.java`

**Create (tests):**
- `opennms-webapp-rest/src/test/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManagerTest.java`
- `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/JmxConfigResourceTest.java`

**Modify (Java/XML):**
- `opennms-webapp-rest/pom.xml` — add `jmxconfiggenerator`, `org.opennms.core.jmx.impl` deps
- `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml` — add `support.jmxconfig` to component-scan

**Modify (config/JSP):**
- `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json`
- `opennms-webapp/src/main/webapp/index.jsp`
- `opennms-webapp/src/main/webapp/admin/jmxConfigGenerator.jsp`

**Create (Vue/TS):**
- `ui/src/services/jmxConfigService.ts`
- `ui/src/stores/jmxConfigStore.ts`
- `ui/src/components/JmxConfig/ConnectionForm.vue`
- `ui/src/components/JmxConfig/MBeanDetection.vue`
- `ui/src/components/JmxConfig/MBeanTree.vue`
- `ui/src/components/JmxConfig/ReviewSave.vue`
- `ui/src/containers/JmxConfigGenerator.vue`

**Modify (Vue/TS):**
- `ui/src/main/router/index.ts`

---

## Task 1: Backend POJOs

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/DetectRequest.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/MBeanAttributeDto.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/MBeanDto.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/DetectJobStatus.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/GenerateRequest.java`
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/GenerateResponse.java`

- [ ] **Step 1: Create the `jmxconfig` support package and DetectRequest**

```bash
mkdir -p opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig
mkdir -p opennms-webapp-rest/src/test/java/org/opennms/web/rest/support/jmxconfig
```

`DetectRequest.java`:
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
package org.opennms.web.rest.support.jmxconfig;

public class DetectRequest {
    private String serviceName = "anyservice";
    private String connection = "service:jmx:rmi://localhost:18980";
    private boolean authenticate = false;
    private String user;
    private String password;
    private boolean skipDefaultVM = true;
    private boolean skipNonNumber = false;

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getConnection() { return connection; }
    public void setConnection(String connection) { this.connection = connection; }
    public boolean isAuthenticate() { return authenticate; }
    public void setAuthenticate(boolean authenticate) { this.authenticate = authenticate; }
    public String getUser() { return user; }
    public void setUser(String user) { this.user = user; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public boolean isSkipDefaultVM() { return skipDefaultVM; }
    public void setSkipDefaultVM(boolean skipDefaultVM) { this.skipDefaultVM = skipDefaultVM; }
    public boolean isSkipNonNumber() { return skipNonNumber; }
    public void setSkipNonNumber(boolean skipNonNumber) { this.skipNonNumber = skipNonNumber; }
}
```

- [ ] **Step 2: Create MBeanAttributeDto and MBeanDto**

`MBeanAttributeDto.java`:
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
package org.opennms.web.rest.support.jmxconfig;

public class MBeanAttributeDto {
    private String name;
    private String alias;
    private String type = "gauge";
    private boolean include = true;

    public MBeanAttributeDto() {}

    public MBeanAttributeDto(String name, String alias, String type) {
        this.name = name;
        this.alias = alias;
        this.type = type;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public boolean isInclude() { return include; }
    public void setInclude(boolean include) { this.include = include; }
}
```

`MBeanDto.java`:
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
package org.opennms.web.rest.support.jmxconfig;

import java.util.ArrayList;
import java.util.List;

public class MBeanDto {
    private String objectName;
    private String name;
    private boolean include = true;
    private List<MBeanAttributeDto> attributes = new ArrayList<>();

    public MBeanDto() {}

    public MBeanDto(String objectName, String name) {
        this.objectName = objectName;
        this.name = name;
    }

    public String getObjectName() { return objectName; }
    public void setObjectName(String objectName) { this.objectName = objectName; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isInclude() { return include; }
    public void setInclude(boolean include) { this.include = include; }
    public List<MBeanAttributeDto> getAttributes() { return attributes; }
    public void setAttributes(List<MBeanAttributeDto> attributes) { this.attributes = attributes; }
}
```

- [ ] **Step 3: Create DetectJobStatus, GenerateRequest, GenerateResponse**

`DetectJobStatus.java`:
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
package org.opennms.web.rest.support.jmxconfig;

import java.util.ArrayList;
import java.util.List;

public class DetectJobStatus {
    public enum Status { PENDING, RUNNING, DONE, ERROR }

    private Status status = Status.PENDING;
    private List<MBeanDto> mbeans = new ArrayList<>();
    private String error;

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public List<MBeanDto> getMbeans() { return mbeans; }
    public void setMbeans(List<MBeanDto> mbeans) { this.mbeans = mbeans; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
```

`GenerateRequest.java`:
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
 * software distributed under the LICENSE is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 * either express or implied.  See the License for the specific
 * language governing permissions and limitations under the
 * License.
 */
package org.opennms.web.rest.support.jmxconfig;

import java.util.ArrayList;
import java.util.List;

public class GenerateRequest {
    private String serviceName = "anyservice";
    private String outputFileName;
    private boolean saveToServer = true;
    private boolean overwrite = false;
    private List<MBeanDto> mbeans = new ArrayList<>();

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getOutputFileName() { return outputFileName; }
    public void setOutputFileName(String outputFileName) { this.outputFileName = outputFileName; }
    public boolean isSaveToServer() { return saveToServer; }
    public void setSaveToServer(boolean saveToServer) { this.saveToServer = saveToServer; }
    public boolean isOverwrite() { return overwrite; }
    public void setOverwrite(boolean overwrite) { this.overwrite = overwrite; }
    public List<MBeanDto> getMbeans() { return mbeans; }
    public void setMbeans(List<MBeanDto> mbeans) { this.mbeans = mbeans; }
}
```

`GenerateResponse.java`:
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
package org.opennms.web.rest.support.jmxconfig;

public class GenerateResponse {
    private String xml;
    private String savedPath;

    public GenerateResponse() {}

    public GenerateResponse(String xml, String savedPath) {
        this.xml = xml;
        this.savedPath = savedPath;
    }

    public String getXml() { return xml; }
    public void setXml(String xml) { this.xml = xml; }
    public String getSavedPath() { return savedPath; }
    public void setSavedPath(String savedPath) { this.savedPath = savedPath; }
}
```

- [ ] **Step 4: Compile check**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn compile -DskipTests -Ddisable.checkstyle 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/
git commit -m "feat(jmx-config): add backend POJOs for JMX config generator REST API"
```

---

## Task 2: pom.xml + Spring configuration

**Files:**
- Modify: `opennms-webapp-rest/pom.xml`
- Modify: `opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml`

- [ ] **Step 1: Add dependencies to pom.xml**

In `opennms-webapp-rest/pom.xml`, inside the `<dependencies>` section (after line 117), add:

```xml
    <dependency>
      <groupId>org.opennms.features</groupId>
      <artifactId>jmxconfiggenerator</artifactId>
      <version>${project.version}</version>
      <scope>${onmsLibScope}</scope>
    </dependency>
    <dependency>
      <groupId>org.opennms.core.jmx</groupId>
      <artifactId>org.opennms.core.jmx.impl</artifactId>
      <version>${project.version}</version>
      <scope>${onmsLibScope}</scope>
    </dependency>
    <dependency>
      <groupId>org.opennms.core.jmx</groupId>
      <artifactId>org.opennms.core.jmx.api</artifactId>
      <version>${project.version}</version>
      <scope>${onmsLibScope}</scope>
    </dependency>
    <dependency>
      <groupId>org.opennms</groupId>
      <artifactId>opennms-config-jaxb</artifactId>
      <scope>${onmsLibScope}</scope>
    </dependency>
```

- [ ] **Step 2: Add `support.jmxconfig` to component-scan**

In `applicationContext-cxf-rest-v2.xml`, change line 20 from:
```xml
    <context:component-scan base-package="org.opennms.web.rest.v2, org.opennms.web.rest.mapper.v2" />
```
to:
```xml
    <context:component-scan base-package="org.opennms.web.rest.v2, org.opennms.web.rest.mapper.v2, org.opennms.web.rest.support.jmxconfig" />
```

- [ ] **Step 3: Compile check**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn compile -DskipTests -Ddisable.checkstyle 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/pom.xml \
        opennms-webapp-rest/src/main/webapp/WEB-INF/applicationContext-cxf-rest-v2.xml
git commit -m "feat(jmx-config): add jmxconfiggenerator and jmx-impl deps to webapp-rest"
```

---

## Task 3: JmxDetectJob

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJob.java`

- [ ] **Step 1: Write JmxDetectJob**

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
package org.opennms.web.rest.support.jmxconfig;

import java.util.ArrayList;
import java.util.List;

import org.opennms.features.jmxconfiggenerator.jmxconfig.JmxDatacollectionConfiggenerator;
import org.opennms.features.jmxconfiggenerator.jmxconfig.JmxHelper;
import org.opennms.features.jmxconfiggenerator.log.Slf4jLogAdapter;
import org.opennms.netmgt.config.collectd.jmx.Attrib;
import org.opennms.netmgt.config.collectd.jmx.JmxDatacollectionConfig;
import org.opennms.netmgt.config.collectd.jmx.Mbean;
import org.opennms.netmgt.jmx.connection.JmxConnectionConfig;
import org.opennms.netmgt.jmx.connection.JmxConnectionConfigBuilder;
import org.opennms.netmgt.jmx.connection.JmxServerConnectionWrapper;
import org.opennms.netmgt.jmx.impl.connection.connectors.DefaultJmxConnector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Async job that connects to a JMX server and enumerates available MBeans.
 * Phase 2a: handles regular Attrib only (not CompAttrib/composite members).
 */
public class JmxDetectJob implements Runnable {
    private static final Logger LOG = LoggerFactory.getLogger(JmxDetectJob.class);

    private final DetectRequest request;
    private volatile DetectJobStatus.Status status = DetectJobStatus.Status.PENDING;
    private volatile List<MBeanDto> result;
    private volatile String error;

    public JmxDetectJob(DetectRequest request) {
        this.request = request;
    }

    @Override
    public void run() {
        status = DetectJobStatus.Status.RUNNING;
        try {
            JmxConnectionConfig connConfig = new JmxConnectionConfigBuilder()
                    .withUrl(request.getConnection())
                    .withUsername(request.isAuthenticate() ? request.getUser() : null)
                    .withPassword(request.isAuthenticate() ? request.getPassword() : null)
                    .build();

            try (JmxServerConnectionWrapper conn = new DefaultJmxConnector().createConnection(connConfig)) {
                JmxDatacollectionConfiggenerator generator = new JmxDatacollectionConfiggenerator(
                        new Slf4jLogAdapter(JmxDatacollectionConfiggenerator.class));
                JmxDatacollectionConfig config = generator.generateJmxConfigModel(
                        conn.getMBeanServerConnection(),
                        request.getServiceName(),
                        !request.isSkipDefaultVM(),
                        request.isSkipNonNumber(),
                        JmxHelper.loadInternalDictionary());
                result = convertToDto(config);
                status = DetectJobStatus.Status.DONE;
            }
        } catch (Exception e) {
            LOG.warn("JMX detection failed for {}: {}", request.getConnection(), e.getMessage(), e);
            error = e.getMessage();
            status = DetectJobStatus.Status.ERROR;
        }
    }

    private List<MBeanDto> convertToDto(JmxDatacollectionConfig config) {
        List<MBeanDto> dtos = new ArrayList<>();
        if (config.getJmxCollectionList().isEmpty()) {
            return dtos;
        }
        for (Mbean mbean : config.getJmxCollectionList().get(0).getMbeans()) {
            MBeanDto dto = new MBeanDto(mbean.getObjectname(), mbean.getName());
            for (Attrib attrib : mbean.getAttribList()) {
                String typeStr = attrib.getType() != null ? attrib.getType().value() : "gauge";
                dto.getAttributes().add(new MBeanAttributeDto(attrib.getName(), attrib.getAlias(), typeStr));
            }
            // CompAttrib (composite) not included in Phase 2a
            dtos.add(dto);
        }
        return dtos;
    }

    public DetectJobStatus.Status getStatus() { return status; }
    public List<MBeanDto> getResult() { return result; }
    public String getError() { return error; }
}
```

- [ ] **Step 2: Compile check**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn compile -DskipTests -Ddisable.checkstyle 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJob.java
git commit -m "feat(jmx-config): add JmxDetectJob async runnable"
```

---

## Task 4: JmxDetectJobManager + unit test

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManager.java`
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManagerTest.java`

- [ ] **Step 1: Write failing test first**

`JmxDetectJobManagerTest.java`:
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
package org.opennms.web.rest.support.jmxconfig;

import static org.junit.Assert.*;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class JmxDetectJobManagerTest {

    private JmxDetectJobManager manager;

    @Before
    public void setUp() {
        manager = new JmxDetectJobManager();
        manager.init();
    }

    @After
    public void tearDown() {
        manager.destroy();
    }

    @Test
    public void submitReturnsUniqueIds() {
        DetectRequest req = new DetectRequest();
        String id1 = manager.submit(req);
        String id2 = manager.submit(req);
        assertNotNull(id1);
        assertNotNull(id2);
        assertNotEquals(id1, id2);
    }

    @Test
    public void getStatusReturnsNullForUnknownId() {
        assertNull(manager.getStatus("nonexistent-id"));
    }

    @Test
    public void getStatusReturnsJobForKnownId() {
        DetectRequest req = new DetectRequest();
        String id = manager.submit(req);
        DetectJobStatus status = manager.getStatus(id);
        assertNotNull(status);
    }

    @Test
    public void expiredJobsAreRemovedAfterTtl() throws InterruptedException {
        JmxDetectJobManager shortTtlManager = new JmxDetectJobManager(100L); // 100ms TTL
        shortTtlManager.init();
        try {
            DetectRequest req = new DetectRequest();
            String id = shortTtlManager.submit(req);
            Thread.sleep(200);
            shortTtlManager.cleanExpiredJobs();
            assertNull(shortTtlManager.getStatus(id));
        } finally {
            shortTtlManager.destroy();
        }
    }
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn test \
  -Dtest=JmxDetectJobManagerTest -Ddisable.checkstyle 2>&1 | tail -10
```

Expected: FAIL — `JmxDetectJobManager` class not found.

- [ ] **Step 3: Implement JmxDetectJobManager**

`JmxDetectJobManager.java`:
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
package org.opennms.web.rest.support.jmxconfig;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class JmxDetectJobManager {
    private static final Logger LOG = LoggerFactory.getLogger(JmxDetectJobManager.class);
    private static final long DEFAULT_TTL_MS = 5 * 60 * 1000L; // 5 minutes

    private final long ttlMs;
    private final Map<String, JobEntry> jobs = new ConcurrentHashMap<>();
    private ExecutorService executor;
    private ScheduledExecutorService cleaner;

    public JmxDetectJobManager() {
        this(DEFAULT_TTL_MS);
    }

    /** Package-visible constructor for testing with custom TTL. */
    JmxDetectJobManager(long ttlMs) {
        this.ttlMs = ttlMs;
    }

    @PostConstruct
    public void init() {
        executor = Executors.newFixedThreadPool(4);
        cleaner = Executors.newSingleThreadScheduledExecutor();
        cleaner.scheduleAtFixedRate(this::cleanExpiredJobs, 1, 1, TimeUnit.MINUTES);
    }

    @PreDestroy
    public void destroy() {
        executor.shutdownNow();
        cleaner.shutdownNow();
    }

    public String submit(DetectRequest request) {
        String jobId = UUID.randomUUID().toString();
        JmxDetectJob job = new JmxDetectJob(request);
        jobs.put(jobId, new JobEntry(job, Instant.now()));
        executor.submit(job);
        LOG.debug("Submitted JMX detection job {} for {}", jobId, request.getConnection());
        return jobId;
    }

    public DetectJobStatus getStatus(String jobId) {
        JobEntry entry = jobs.get(jobId);
        if (entry == null) {
            return null;
        }
        JmxDetectJob job = entry.job;
        DetectJobStatus status = new DetectJobStatus();
        status.setStatus(job.getStatus());
        if (job.getStatus() == DetectJobStatus.Status.DONE) {
            status.setMbeans(job.getResult());
        } else if (job.getStatus() == DetectJobStatus.Status.ERROR) {
            status.setError(job.getError());
        }
        return status;
    }

    /** Exposed for testing; normally called by scheduler. */
    void cleanExpiredJobs() {
        Instant cutoff = Instant.now().minusMillis(ttlMs);
        jobs.entrySet().removeIf(e -> e.getValue().submittedAt.isBefore(cutoff));
    }

    private static class JobEntry {
        final JmxDetectJob job;
        final Instant submittedAt;

        JobEntry(JmxDetectJob job, Instant submittedAt) {
            this.job = job;
            this.submittedAt = submittedAt;
        }
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn test \
  -Dtest=JmxDetectJobManagerTest -Ddisable.checkstyle 2>&1 | tail -10
```

Expected: `Tests run: 4, Failures: 0, Errors: 0`

- [ ] **Step 5: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManager.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/support/jmxconfig/JmxDetectJobManagerTest.java
git commit -m "feat(jmx-config): add JmxDetectJobManager with TTL cleanup and unit tests"
```

---

## Task 5: JmxConfigResource + XML generation test

**Files:**
- Create: `opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/JmxConfigResource.java`
- Create: `opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/JmxConfigResourceTest.java`

- [ ] **Step 1: Write failing test for XML generation**

`JmxConfigResourceTest.java`:
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
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;

import java.util.List;

import org.junit.Test;
import org.opennms.web.rest.support.jmxconfig.GenerateRequest;
import org.opennms.web.rest.support.jmxconfig.MBeanAttributeDto;
import org.opennms.web.rest.support.jmxconfig.MBeanDto;

public class JmxConfigResourceTest {

    @Test
    public void buildXmlContainsServiceName() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto mbean = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        MBeanAttributeDto attr = new MBeanAttributeDto("HeapMemoryUsage", "heapMemUsage", "gauge");
        attr.setInclude(true);
        mbean.getAttributes().add(attr);
        req.setMbeans(List.of(mbean));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue("XML should contain service name", xml.contains("myservice"));
        assertTrue("XML should contain object name", xml.contains("java.lang:type=Memory"));
        assertTrue("XML should contain alias", xml.contains("heapMemUsage"));
    }

    @Test
    public void buildXmlExcludesUnselectedAttributes() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto mbean = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        MBeanAttributeDto included = new MBeanAttributeDto("HeapMemoryUsage", "heapMemUsage", "gauge");
        included.setInclude(true);
        MBeanAttributeDto excluded = new MBeanAttributeDto("NonHeapMemoryUsage", "nonHeapMem", "gauge");
        excluded.setInclude(false);
        mbean.getAttributes().add(included);
        mbean.getAttributes().add(excluded);
        req.setMbeans(List.of(mbean));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue(xml.contains("heapMemUsage"));
        assertFalse(xml.contains("nonHeapMem"));
    }

    @Test
    public void buildXmlExcludesUnselectedMBeans() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto included = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        included.setInclude(true);
        MBeanDto excluded = new MBeanDto("java.lang:type=Threading", "JVM Threading");
        excluded.setInclude(false);
        req.setMbeans(List.of(included, excluded));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue(xml.contains("java.lang:type=Memory"));
        assertFalse(xml.contains("java.lang:type=Threading"));
    }

    @Test
    public void sanitizeFilenameRejectsDotDot() {
        assertThrows(IllegalArgumentException.class,
            () -> JmxConfigResource.sanitizeFileName("../etc/passwd"));
    }

    @Test
    public void sanitizeFilenameRejectsSlash() {
        assertThrows(IllegalArgumentException.class,
            () -> JmxConfigResource.sanitizeFileName("sub/dir/file.xml"));
    }

    @Test
    public void sanitizeFilenameAcceptsValidName() {
        assertEquals("myservice-jmx.xml", JmxConfigResource.sanitizeFileName("myservice-jmx.xml"));
    }
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn test \
  -Dtest=JmxConfigResourceTest -Ddisable.checkstyle 2>&1 | tail -10
```

Expected: FAIL — `JmxConfigResource` class not found.

- [ ] **Step 3: Implement JmxConfigResource**

`JmxConfigResource.java`:
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
package org.opennms.web.rest.v2;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.Map;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.netmgt.config.collectd.jmx.Attrib;
import org.opennms.netmgt.config.collectd.jmx.AttributeType;
import org.opennms.netmgt.config.collectd.jmx.JmxCollection;
import org.opennms.netmgt.config.collectd.jmx.JmxDatacollectionConfig;
import org.opennms.netmgt.config.collectd.jmx.Mbean;
import org.opennms.netmgt.config.collectd.jmx.Rrd;
import org.opennms.web.api.Authentication;
import org.opennms.web.rest.support.jmxconfig.DetectJobStatus;
import org.opennms.web.rest.support.jmxconfig.DetectRequest;
import org.opennms.web.rest.support.jmxconfig.GenerateRequest;
import org.opennms.web.rest.support.jmxconfig.GenerateResponse;
import org.opennms.web.rest.support.jmxconfig.JmxDetectJobManager;
import org.opennms.web.rest.support.jmxconfig.MBeanAttributeDto;
import org.opennms.web.rest.support.jmxconfig.MBeanDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Path("jmx-config")
@Tag(name = "JmxConfig", description = "JMX Configuration Generator API")
public class JmxConfigResource {
    private static final Logger LOG = LoggerFactory.getLogger(JmxConfigResource.class);

    @Autowired
    private JmxDetectJobManager jobManager;

    @POST
    @Path("/detect")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Start async MBean detection", operationId = "JmxConfigResourceDetect")
    public Response detect(DetectRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        String jobId = jobManager.submit(request);
        Map<String, String> resp = new HashMap<>();
        resp.put("jobId", jobId);
        return Response.accepted(resp).build();
    }

    @GET
    @Path("/detect/{jobId}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Poll MBean detection job status", operationId = "JmxConfigResourcePoll")
    public Response pollDetect(@PathParam("jobId") String jobId, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        DetectJobStatus status = jobManager.getStatus(jobId);
        if (status == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(status).build();
    }

    @POST
    @Path("/generate")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Generate JMX datacollection XML", operationId = "JmxConfigResourceGenerate")
    public Response generate(GenerateRequest request, @Context SecurityContext securityContext) {
        if (!securityContext.isUserInRole(Authentication.ROLE_ADMIN)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        String fileName = request.getOutputFileName();
        if (fileName == null || fileName.isBlank()) {
            fileName = request.getServiceName() + "-jmx.xml";
        }

        try {
            fileName = sanitizeFileName(fileName);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getMessage())).build();
        }

        String xml = buildXml(request);
        String savedPath = null;

        if (request.isSaveToServer()) {
            String opennmsHome = System.getProperty("opennms.home", "/opt/opennms");
            Path outputDir = Paths.get(opennmsHome, "etc", "jmx-datacollection-config.d");
            Path outputFile = outputDir.resolve(fileName);

            try {
                Files.createDirectories(outputDir);
            } catch (IOException e) {
                LOG.error("Cannot create output directory {}: {}", outputDir, e.getMessage(), e);
                return Response.serverError().entity(Map.of("error", "Cannot create output directory: " + e.getMessage())).build();
            }

            if (outputFile.toFile().exists() && !request.isOverwrite()) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("error", "File already exists: " + fileName)).build();
            }

            try {
                Files.writeString(outputFile, xml, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
                savedPath = outputFile.toString();
                LOG.info("Saved JMX config to {}", savedPath);
            } catch (IOException e) {
                LOG.error("Cannot write JMX config to {}: {}", outputFile, e.getMessage(), e);
                return Response.serverError().entity(Map.of("error", "Cannot write file: " + e.getMessage())).build();
            }
        }

        return Response.ok(new GenerateResponse(xml, savedPath)).build();
    }

    /** Builds a JmxDatacollectionConfig XML string from the user's selections. Visible for testing. */
    public static String buildXml(GenerateRequest request) {
        JmxDatacollectionConfig config = new JmxDatacollectionConfig();
        JmxCollection collection = new JmxCollection();
        collection.setName(request.getServiceName());

        Rrd rrd = new Rrd();
        rrd.setStep(300);
        rrd.addRra("RRA:AVERAGE:0.5:1:2016");
        rrd.addRra("RRA:AVERAGE:0.5:12:1488");
        rrd.addRra("RRA:AVERAGE:0.5:288:366");
        rrd.addRra("RRA:MAX:0.5:288:366");
        rrd.addRra("RRA:MIN:0.5:288:366");
        collection.setRrd(rrd);

        for (MBeanDto mbeanDto : request.getMbeans()) {
            if (!mbeanDto.isInclude()) {
                continue;
            }
            Mbean mbean = new Mbean();
            mbean.setObjectname(mbeanDto.getObjectName());
            mbean.setName(mbeanDto.getName() != null ? mbeanDto.getName() : mbeanDto.getObjectName());

            for (MBeanAttributeDto attrDto : mbeanDto.getAttributes()) {
                if (!attrDto.isInclude()) {
                    continue;
                }
                Attrib attrib = new Attrib();
                attrib.setName(attrDto.getName());
                attrib.setAlias(attrDto.getAlias());
                attrib.setType(parseAttributeType(attrDto.getType()));
                mbean.addAttrib(attrib);
            }
            collection.addMbean(mbean);
        }

        config.addJmxCollection(collection);
        return JaxbUtils.marshal(config);
    }

    /** Validates and returns the filename. Rejects path traversal and directory separators. Visible for testing. */
    public static String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new IllegalArgumentException("File name must not be blank");
        }
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains(File.separator)) {
            throw new IllegalArgumentException("File name must not contain path separators or '..'");
        }
        return fileName;
    }

    private static AttributeType parseAttributeType(String type) {
        if (type == null) {
            return AttributeType.GAUGE;
        }
        try {
            return AttributeType.fromValue(type.toLowerCase());
        } catch (IllegalArgumentException e) {
            return AttributeType.GAUGE;
        }
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn test \
  -Dtest=JmxConfigResourceTest -Ddisable.checkstyle 2>&1 | tail -10
```

Expected: `Tests run: 6, Failures: 0, Errors: 0`

- [ ] **Step 5: Full module compile and test**

```bash
cd opennms-webapp-rest && ../../maven/bin/mvn test \
  -Dtest="JmxDetectJobManagerTest,JmxConfigResourceTest" -Ddisable.checkstyle 2>&1 | tail -10
```

Expected: `Tests run: 10, Failures: 0, Errors: 0`

- [ ] **Step 6: Commit**

```bash
git add opennms-webapp-rest/src/main/java/org/opennms/web/rest/v2/JmxConfigResource.java \
        opennms-webapp-rest/src/test/java/org/opennms/web/rest/v2/JmxConfigResourceTest.java
git commit -m "feat(jmx-config): add JmxConfigResource JAX-RS endpoints with XML generation"
```

---

## Task 6: Menu, JSP, and landing page changes

**Files:**
- Modify: `opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json`
- Modify: `opennms-webapp/src/main/webapp/index.jsp`
- Modify: `opennms-webapp/src/main/webapp/admin/jmxConfigGenerator.jsp`

- [ ] **Step 1: Update menu-template.json**

In `menu-template.json`:

1. In `dashboardsMenu.items`, prepend (before `surveillanceDashboard`):
```json
{
  "id": "vueDashboard",
  "name": "Dashboard",
  "url": "ui/index.html#/dashboard",
  "locationMatch": "dashboard",
  "roles": null
},
```

2. In `toolsMenu.items`, find `jmxMetricConfigurationGenerator` and change its `url`:
```json
"url": "ui/index.html#/jmx-config-generator"
```

- [ ] **Step 2: Redirect index.jsp to Vue dashboard**

Replace the entire body of `opennms-webapp/src/main/webapp/index.jsp` (everything after the license header, keeping the license header) with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboard"); %>
```

The full file should be:
```jsp
<%--

    Licensed to The OpenNMS Group, Inc (TOG) under one or more
    contributor license agreements.  See the LICENSE.md file
    distributed with this work for additional information
    regarding copyright ownership.

    TOG licenses this file to You under the GNU Affero General
    Public License Version 3 (the "License") or (at your option)
    any later version.  You may not use this file except in
    compliance with the License.  You may obtain a copy of the
    License at:

         https://www.gnu.org/licenses/agpl-3.0.txt

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
    either express or implied.  See the License for the specific
    language governing permissions and limitations under the
    License.

--%>
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/dashboard"); %>
```

- [ ] **Step 3: Redirect jmxConfigGenerator.jsp to Vue route**

Replace the body of `opennms-webapp/src/main/webapp/admin/jmxConfigGenerator.jsp` (everything after the license header) with:

```jsp
<%@page language="java" contentType="text/html" session="true" %>
<% response.sendRedirect(request.getContextPath() + "/ui/index.html#/jmx-config-generator"); %>
```

- [ ] **Step 4: Commit**

```bash
git add opennms-webapp-rest/src/main/webapp/WEB-INF/menu/menu-template.json \
        opennms-webapp/src/main/webapp/index.jsp \
        opennms-webapp/src/main/webapp/admin/jmxConfigGenerator.jsp
git commit -m "feat(jmx-config): redirect landing page and JMX JSP to Vue routes; add dashboard to menu"
```

---

## Task 7: Frontend data layer — service + store

**Files:**
- Create: `ui/src/services/jmxConfigService.ts`
- Create: `ui/src/stores/jmxConfigStore.ts`

- [ ] **Step 1: Create jmxConfigService.ts**

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { rest } from './axiosInstances'

export interface DetectRequest {
  serviceName: string
  connection: string
  authenticate: boolean
  user: string | null
  password: string | null
  skipDefaultVM: boolean
  skipNonNumber: boolean
}

export interface MBeanAttributeDto {
  name: string
  alias: string
  type: string
  include: boolean
}

export interface MBeanDto {
  objectName: string
  name: string
  include: boolean
  attributes: MBeanAttributeDto[]
}

export interface DetectJobStatus {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR'
  mbeans: MBeanDto[]
  error: string | null
}

export interface GenerateRequest {
  serviceName: string
  outputFileName: string
  saveToServer: boolean
  overwrite: boolean
  mbeans: MBeanDto[]
}

export interface GenerateResponse {
  xml: string
  savedPath: string | null
}

const BASE = 'jmx-config'

export const startDetect = async (request: DetectRequest): Promise<string> => {
  const resp = await rest.post(`${BASE}/detect`, request)
  return resp.data.jobId as string
}

export const pollDetect = async (jobId: string): Promise<DetectJobStatus> => {
  const resp = await rest.get(`${BASE}/detect/${jobId}`)
  return resp.data as DetectJobStatus
}

export const generate = async (request: GenerateRequest): Promise<GenerateResponse> => {
  const resp = await rest.post(`${BASE}/generate`, request)
  return resp.data as GenerateResponse
}
```

- [ ] **Step 2: Create jmxConfigStore.ts**

```typescript
///
/// Licensed to The OpenNMS Group, Inc (TOG) under one or more
/// contributor license agreements.  See the LICENSE.md file
/// distributed with this work for additional information
/// regarding copyright ownership.
///
/// TOG licenses this file to You under the GNU Affero General
/// Public License Version 3 (the "License") or (at your option)
/// any later version.  You may not use this file except in
/// compliance with the License.  You may obtain a copy of the
/// License at:
///
///      https://www.gnu.org/licenses/agpl-3.0.txt
///
/// Unless required by applicable law or agreed to in writing,
/// software distributed under the License is distributed on an
/// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
/// either express or implied.  See the License for the specific
/// language governing permissions and limitations under the
/// License.
///

import { defineStore } from 'pinia'
import type { DetectRequest, MBeanDto, GenerateResponse } from '@/services/jmxConfigService'

export const useJmxConfigStore = defineStore('jmxConfigStore', () => {
  const currentStep = ref<1 | 2 | 3 | 4>(1)

  const connectionConfig = ref<DetectRequest>({
    serviceName: 'anyservice',
    connection: 'service:jmx:rmi://localhost:18980',
    authenticate: false,
    user: null,
    password: null,
    skipDefaultVM: true,
    skipNonNumber: false
  })

  const jobId = ref<string | null>(null)
  const jobStatus = ref<'idle' | 'pending' | 'running' | 'done' | 'error'>('idle')
  const jobError = ref<string | null>(null)

  const mbeans = ref<MBeanDto[]>([])
  const outputFileName = ref<string>('')
  const generatedXml = ref<string | null>(null)
  const savedPath = ref<string | null>(null)
  const generateError = ref<string | null>(null)

  const setDetectionResult = (detected: MBeanDto[]) => {
    mbeans.value = detected
    outputFileName.value = `${connectionConfig.value.serviceName}-jmx.xml`
  }

  const setGenerateResult = (result: GenerateResponse) => {
    generatedXml.value = result.xml
    savedPath.value = result.savedPath
  }

  const reset = () => {
    currentStep.value = 1
    jobId.value = null
    jobStatus.value = 'idle'
    jobError.value = null
    mbeans.value = []
    generatedXml.value = null
    savedPath.value = null
    generateError.value = null
  }

  return {
    currentStep,
    connectionConfig,
    jobId,
    jobStatus,
    jobError,
    mbeans,
    outputFileName,
    generatedXml,
    savedPath,
    generateError,
    setDetectionResult,
    setGenerateResult,
    reset
  }
})
```

- [ ] **Step 3: TypeScript check**

```bash
cd ui && pnpm run type-check 2>&1 | grep -E "error|warning" | head -20
```

Expected: no errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add ui/src/services/jmxConfigService.ts ui/src/stores/jmxConfigStore.ts
git commit -m "feat(jmx-config): add jmxConfigService and jmxConfigStore"
```

---

## Task 8: ConnectionForm.vue (Step 1)

**Files:**
- Create: `ui/src/components/JmxConfig/ConnectionForm.vue`

- [ ] **Step 1: Create the component**

```bash
mkdir -p ui/src/components/JmxConfig
```

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="connection-form">
    <h2 class="step-title">Step 1: JMX Connection</h2>

    <div class="form-field">
      <FeatherInput
        v-model="config.serviceName"
        label="Service Name"
        hint="Used as the collection name in the generated XML (e.g. jmx-cassandra)"
      />
    </div>

    <div class="form-field">
      <FeatherInput
        v-model="config.connection"
        label="JMX Connection URL"
        hint="e.g. service:jmx:rmi://hostname:port/jndi/rmi://hostname:port/jmxrmi"
      />
    </div>

    <div class="form-field">
      <FeatherCheckbox v-model="config.authenticate" label="Requires Authentication" />
    </div>

    <template v-if="config.authenticate">
      <div class="form-field">
        <FeatherInput v-model="config.user" label="Username" />
      </div>
      <div class="form-field">
        <FeatherInput v-model="config.password" label="Password" type="password" />
      </div>
    </template>

    <div class="form-field options-row">
      <FeatherCheckbox v-model="config.skipDefaultVM" label="Skip Default JVM MBeans" />
      <FeatherCheckbox v-model="config.skipNonNumber" label="Skip Non-numeric Attributes" />
    </div>

    <div class="form-actions">
      <FeatherButton primary @click="$emit('submit', config)" :disabled="!isValid">
        Detect MBeans
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherCheckbox } from '@featherds/checkbox'
import { FeatherButton } from '@featherds/button'
import type { DetectRequest } from '@/services/jmxConfigService'

const props = defineProps<{ modelValue: DetectRequest }>()
const emit = defineEmits<{
  (e: 'submit', config: DetectRequest): void
  (e: 'update:modelValue', config: DetectRequest): void
}>()

const config = reactive({ ...props.modelValue })

watch(config, (val) => emit('update:modelValue', { ...val }), { deep: true })

const isValid = computed(() =>
  config.serviceName.trim().length > 0 &&
  config.connection.trim().length > 0 &&
  (!config.authenticate || (!!config.user && !!config.password))
)
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.connection-form {
  max-width: 600px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
}

.options-row {
  display: flex;
  gap: 2rem;
}

.form-actions {
  margin-top: 1.5rem;
}
</style>
```

- [ ] **Step 2: Build check**

```bash
cd ui && pnpm run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/JmxConfig/ConnectionForm.vue
git commit -m "feat(jmx-config): add ConnectionForm step 1 component"
```

---

## Task 9: MBeanDetection.vue (Step 2 — polling)

**Files:**
- Create: `ui/src/components/JmxConfig/MBeanDetection.vue`

- [ ] **Step 1: Create the component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="mbean-detection">
    <h2 class="step-title">Step 2: Detecting MBeans</h2>

    <div v-if="status === 'pending' || status === 'running'" class="detecting">
      <FeatherSpinner />
      <p class="detecting-msg">Connecting to JMX server and enumerating MBeans…</p>
    </div>

    <div v-else-if="status === 'error'" class="detection-error">
      <p class="error-text">Detection failed: {{ error }}</p>
      <FeatherButton @click="$emit('back')">Back</FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherSpinner } from '@featherds/progress'
import { FeatherButton } from '@featherds/button'
import { pollDetect } from '@/services/jmxConfigService'
import type { MBeanDto } from '@/services/jmxConfigService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{ jobId: string }>()
const emit = defineEmits<{
  (e: 'done', mbeans: MBeanDto[]): void
  (e: 'back'): void
}>()

const status = ref<'pending' | 'running' | 'done' | 'error'>('pending')
const error = ref<string | null>(null)
const { showSnackBar } = useSnackbar()

let pollTimer: ReturnType<typeof setInterval> | null = null
let networkFailures = 0
const MAX_NETWORK_FAILURES = 3

const startPolling = () => {
  pollTimer = setInterval(async () => {
    try {
      const result = await pollDetect(props.jobId)
      networkFailures = 0

      if (result.status === 'DONE') {
        stopPolling()
        status.value = 'done'
        emit('done', result.mbeans)
      } else if (result.status === 'ERROR') {
        stopPolling()
        status.value = 'error'
        error.value = result.error ?? 'Unknown error'
      } else {
        status.value = 'running'
      }
    } catch (e) {
      networkFailures++
      if (networkFailures >= MAX_NETWORK_FAILURES) {
        stopPolling()
        status.value = 'error'
        error.value = 'Network error while polling for job status'
      }
    }
  }, 2000)
}

const stopPolling = () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => startPolling())
onUnmounted(() => stopPolling())
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.mbean-detection {
  max-width: 600px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.detecting {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.detecting-msg {
  @include typo.body-large();
  color: var($secondary-text-on-surface);
}

.detection-error {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-text {
  @include typo.body-large();
  color: var($error);
}
</style>
```

- [ ] **Step 2: Build check**

```bash
cd ui && pnpm run build 2>&1 | grep -E "^.*error" | grep -v "node_modules" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/JmxConfig/MBeanDetection.vue
git commit -m "feat(jmx-config): add MBeanDetection step 2 component with polling"
```

---

## Task 10: MBeanTree.vue (Step 3 — selection)

**Files:**
- Create: `ui/src/components/JmxConfig/MBeanTree.vue`

- [ ] **Step 1: Create the component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="mbean-tree">
    <h2 class="step-title">Step 3: Select MBeans and Attributes</h2>

    <div class="tree-toolbar">
      <FeatherButton text @click="selectAll">Select All</FeatherButton>
      <FeatherButton text @click="deselectAll">Deselect All</FeatherButton>
      <span class="count-summary">{{ selectedCount }} of {{ totalCount }} attributes selected</span>
    </div>

    <div class="mbean-list">
      <div v-for="mbean in localMbeans" :key="mbean.objectName" class="mbean-row">
        <div class="mbean-header" @click="toggleExpand(mbean.objectName)">
          <FeatherCheckbox
            :modelValue="mbean.include"
            :label="mbean.name || mbean.objectName"
            @update:modelValue="(v) => { mbean.include = v }"
            @click.stop
          />
          <span class="mbean-objectname">{{ mbean.objectName }}</span>
          <span class="expand-icon">{{ expanded.has(mbean.objectName) ? '▲' : '▼' }}</span>
        </div>

        <div v-if="expanded.has(mbean.objectName)" class="attribute-list">
          <div
            v-for="attr in mbean.attributes"
            :key="attr.name"
            class="attribute-row"
          >
            <FeatherCheckbox
              :modelValue="attr.include"
              :label="attr.name"
              @update:modelValue="(v) => { attr.include = v }"
            />
            <FeatherInput
              v-model="attr.alias"
              label="Alias (optional)"
              class="alias-input"
            />
            <span class="attr-type">{{ attr.type }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="form-actions">
      <FeatherButton @click="$emit('back')">Back</FeatherButton>
      <FeatherButton primary @click="$emit('next', localMbeans)" :disabled="selectedCount === 0">
        Next
      </FeatherButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherCheckbox } from '@featherds/checkbox'
import { FeatherButton } from '@featherds/button'
import { FeatherInput } from '@featherds/input'
import type { MBeanDto } from '@/services/jmxConfigService'

const props = defineProps<{ mbeans: MBeanDto[] }>()
const emit = defineEmits<{
  (e: 'next', mbeans: MBeanDto[]): void
  (e: 'back'): void
}>()

// Deep-clone so edits don't mutate the store directly
const localMbeans = ref<MBeanDto[]>(JSON.parse(JSON.stringify(props.mbeans)))

const expanded = ref<Set<string>>(new Set())

const toggleExpand = (objectName: string) => {
  if (expanded.value.has(objectName)) {
    expanded.value.delete(objectName)
  } else {
    expanded.value.add(objectName)
  }
}

const selectedCount = computed(() =>
  localMbeans.value
    .filter(m => m.include)
    .flatMap(m => m.attributes)
    .filter(a => a.include)
    .length
)

const totalCount = computed(() =>
  localMbeans.value.flatMap(m => m.attributes).length
)

const selectAll = () => {
  localMbeans.value.forEach(m => {
    m.include = true
    m.attributes.forEach(a => { a.include = true })
  })
}

const deselectAll = () => {
  localMbeans.value.forEach(m => {
    m.include = false
    m.attributes.forEach(a => { a.include = false })
  })
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.mbean-tree {
  width: 100%;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1rem;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.count-summary {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  margin-left: auto;
}

.mbean-list {
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  max-height: 60vh;
  overflow-y: auto;
}

.mbean-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var($surface-dark);
  cursor: pointer;
  user-select: none;

  &:hover {
    background: var($surface-dark);
    filter: brightness(0.95);
  }
}

.mbean-objectname {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  flex: 1;
}

.expand-icon {
  @include typo.caption();
  color: var($secondary-text-on-surface);
}

.attribute-list {
  padding: 0.25rem 0;
}

.attribute-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.25rem 1rem 0.25rem 3rem;
}

.alias-input {
  max-width: 200px;
  opacity: 0.7;
}

.attr-type {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  min-width: 60px;
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}
</style>
```

- [ ] **Step 2: Build check**

```bash
cd ui && pnpm run build 2>&1 | grep -E "^.*error" | grep -v "node_modules" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/JmxConfig/MBeanTree.vue
git commit -m "feat(jmx-config): add MBeanTree step 3 component with select/deselect and alias editing"
```

---

## Task 11: ReviewSave.vue (Step 4)

**Files:**
- Create: `ui/src/components/JmxConfig/ReviewSave.vue`

- [ ] **Step 1: Create the component**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="review-save">
    <h2 class="step-title">Step 4: Review and Save</h2>

    <div v-if="!generated" class="generate-section">
      <div class="form-field">
        <FeatherInput
          v-model="localFileName"
          label="Output File Name"
          hint="Saved to /opt/opennms/etc/jmx-datacollection-config.d/"
        />
      </div>

      <div v-if="error" class="inline-error">
        <span v-if="conflictError">
          File already exists.
          <FeatherButton text @click="generateWithOverwrite">Overwrite</FeatherButton>
        </span>
        <span v-else>{{ error }}</span>
      </div>

      <div class="form-actions">
        <FeatherButton @click="$emit('back')">Back</FeatherButton>
        <FeatherButton primary @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save to Server' }}
        </FeatherButton>
      </div>
    </div>

    <div v-else class="result-section">
      <div class="saved-path" v-if="savedPath">
        Saved to <code>{{ savedPath }}</code>
      </div>

      <div class="xml-preview-label">Generated XML:</div>
      <textarea class="xml-preview" readonly :value="xml" />

      <div class="form-actions">
        <FeatherButton @click="download">Download XML</FeatherButton>
        <FeatherButton text @click="$emit('reset')">Start Over</FeatherButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FeatherInput } from '@featherds/input'
import { FeatherButton } from '@featherds/button'
import { generate } from '@/services/jmxConfigService'
import type { MBeanDto } from '@/services/jmxConfigService'
import useSnackbar from '@/composables/useSnackbar'

const props = defineProps<{
  serviceName: string
  outputFileName: string
  mbeans: MBeanDto[]
}>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'reset'): void
}>()

const { showSnackBar } = useSnackbar()
const localFileName = ref(props.outputFileName)
const saving = ref(false)
const generated = ref(false)
const xml = ref('')
const savedPath = ref<string | null>(null)
const error = ref<string | null>(null)
const conflictError = ref(false)

const doGenerate = async (overwrite: boolean) => {
  saving.value = true
  error.value = null
  conflictError.value = false
  try {
    const result = await generate({
      serviceName: props.serviceName,
      outputFileName: localFileName.value,
      saveToServer: true,
      overwrite,
      mbeans: props.mbeans
    })
    xml.value = result.xml
    savedPath.value = result.savedPath
    generated.value = true
    if (result.savedPath) {
      showSnackBar({ msg: `Saved to ${result.savedPath}` })
    }
  } catch (e: any) {
    if (e?.response?.status === 409) {
      conflictError.value = true
      error.value = 'File already exists.'
    } else {
      error.value = e?.response?.data?.error ?? 'Failed to generate configuration.'
    }
  } finally {
    saving.value = false
  }
}

const save = () => doGenerate(false)
const generateWithOverwrite = () => doGenerate(true)

const download = () => {
  const blob = new Blob([xml.value], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = localFileName.value
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.review-save {
  max-width: 800px;
}

.step-title {
  @include typo.headline2();
  margin-bottom: 1.5rem;
}

.form-field {
  margin-bottom: 1rem;
}

.form-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}

.inline-error {
  @include typo.body-small();
  color: var($error);
  margin-bottom: 1rem;
}

.saved-path {
  @include typo.body-small();
  color: var($secondary-text-on-surface);
  margin-bottom: 1rem;

  code {
    font-family: monospace;
  }
}

.xml-preview-label {
  @include typo.caption();
  color: var($secondary-text-on-surface);
  margin-bottom: 0.25rem;
}

.xml-preview {
  width: 100%;
  height: 400px;
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid var($border-on-surface);
  border-radius: 4px;
  padding: 0.5rem;
  resize: vertical;
  background: var($surface-dark);
  color: var($primary-text-on-surface);
}
</style>
```

- [ ] **Step 2: Build check**

```bash
cd ui && pnpm run build 2>&1 | grep -E "^.*error" | grep -v "node_modules" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add ui/src/components/JmxConfig/ReviewSave.vue
git commit -m "feat(jmx-config): add ReviewSave step 4 component with save, overwrite, and download"
```

---

## Task 12: JmxConfigGenerator.vue container + router

**Files:**
- Create: `ui/src/containers/JmxConfigGenerator.vue`
- Modify: `ui/src/main/router/index.ts`

- [ ] **Step 1: Create the wizard container**

```vue
<!--
  Licensed to The OpenNMS Group, Inc (TOG) under one or more
  contributor license agreements.  See the LICENSE.md file
  distributed with this work for additional information
  regarding copyright ownership.

  TOG licenses this file to You under the GNU Affero General
  Public License Version 3 (the "License") or (at your option)
  any later version.  You may not use this file except in
  compliance with the License.  You may obtain a copy of the
  License at:

       https://www.gnu.org/licenses/agpl-3.0.txt

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
  either express or implied.  See the License for the specific
  language governing permissions and limitations under the
  License.
-->

<template>
  <div class="jmx-config-generator">
    <BreadCrumbs :items="breadcrumbs" />
    <h1 class="page-title">JMX Configuration Generator</h1>

    <div class="step-indicator">
      <span
        v-for="(label, i) in stepLabels"
        :key="i"
        class="step-chip"
        :class="{ active: store.currentStep === i + 1, done: store.currentStep > i + 1 }"
      >{{ i + 1 }}. {{ label }}</span>
    </div>

    <div class="wizard-body">
      <ConnectionForm
        v-if="store.currentStep === 1"
        v-model="store.connectionConfig"
        @submit="onConnectionSubmit"
      />

      <MBeanDetection
        v-else-if="store.currentStep === 2"
        :jobId="store.jobId!"
        @done="onDetectionDone"
        @back="store.currentStep = 1"
      />

      <MBeanTree
        v-else-if="store.currentStep === 3"
        :mbeans="store.mbeans"
        @next="onMBeansSelected"
        @back="store.currentStep = 1"
      />

      <ReviewSave
        v-else-if="store.currentStep === 4"
        :serviceName="store.connectionConfig.serviceName"
        :outputFileName="store.outputFileName"
        :mbeans="store.mbeans"
        @back="store.currentStep = 3"
        @reset="store.reset()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import BreadCrumbs from '@/components/Layout/BreadCrumbs.vue'
import ConnectionForm from '@/components/JmxConfig/ConnectionForm.vue'
import MBeanDetection from '@/components/JmxConfig/MBeanDetection.vue'
import MBeanTree from '@/components/JmxConfig/MBeanTree.vue'
import ReviewSave from '@/components/JmxConfig/ReviewSave.vue'
import { useJmxConfigStore } from '@/stores/jmxConfigStore'
import { startDetect } from '@/services/jmxConfigService'
import type { DetectRequest, MBeanDto } from '@/services/jmxConfigService'
import useSnackbar from '@/composables/useSnackbar'

const store = useJmxConfigStore()
const { showSnackBar } = useSnackbar()

const breadcrumbs = [
  { label: 'Admin', to: { path: '/' } },
  { label: 'JMX Configuration Generator' }
]

const stepLabels = ['Connection', 'Detecting', 'Select MBeans', 'Review & Save']

const onConnectionSubmit = async (config: DetectRequest) => {
  try {
    store.jobStatus = 'pending'
    store.currentStep = 2
    const jobId = await startDetect(config)
    store.jobId = jobId
  } catch (e: any) {
    store.currentStep = 1
    showSnackBar({ msg: 'Failed to start detection: ' + (e?.message ?? 'Unknown error') })
  }
}

const onDetectionDone = (mbeans: MBeanDto[]) => {
  store.setDetectionResult(mbeans)
  store.currentStep = 3
}

const onMBeansSelected = (mbeans: MBeanDto[]) => {
  store.mbeans = mbeans
  store.currentStep = 4
}
</script>

<style lang="scss" scoped>
@import "@featherds/styles/themes/variables";
@use "@featherds/styles/mixins/typography" as typo;

.jmx-config-generator {
  padding: 1.5rem;
}

.page-title {
  @include typo.headline1();
  margin-bottom: 1rem;
}

.step-indicator {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.step-chip {
  @include typo.caption();
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid var($border-on-surface);
  color: var($secondary-text-on-surface);

  &.active {
    background: var($clickable-normal);
    color: white;
    border-color: var($clickable-normal);
  }

  &.done {
    background: var($surface-dark);
    color: var($secondary-text-on-surface);
  }
}

.wizard-body {
  max-width: 900px;
}
</style>
```

- [ ] **Step 2: Add route to router/index.ts**

In `ui/src/main/router/index.ts`, add after the `/usage-statistics` route block (before the catch-all):

```typescript
    {
      path: '/jmx-config-generator',
      name: 'JMX Config Generator',
      component: () => import('@/containers/JmxConfigGenerator.vue'),
      beforeEnter: (to, from) => {
        const checkRoles = () => {
          if (!adminRole.value) {
            showSnackBar({ msg: 'Must be admin to access JMX Config Generator.' })
            router.push(from.path)
          }
        }

        if (rolesAreLoaded.value) checkRoles()
        else whenever(rolesAreLoaded, () => checkRoles())
      }
    },
```

- [ ] **Step 3: Full build**

```bash
cd ui && pnpm run build 2>&1 | tail -15
```

Expected: `✓ built in` with no errors. The `dist/` output will be in `ui/src/main/dist/`.

- [ ] **Step 4: Commit**

```bash
git add ui/src/containers/JmxConfigGenerator.vue ui/src/main/router/index.ts
git commit -m "feat(jmx-config): add JmxConfigGenerator wizard container and router entry"
```

---

## Task 13: Deploy and E2E verification

**Files:** No code changes — build and deploy to running container.

Prerequisites: Container must be running. See memory file `reference_manual_e2e_testing.md` for container start commands. The overlay image (`localhost/opennms/horizon:35.0.5-dark-mode`) must have been built previously.

- [ ] **Step 1: Build Vue SPA**

```bash
cd /Users/chance/git/opennms/ui && pnpm run build
```

Expected: `✓ built in` with no errors.

- [ ] **Step 2: Deploy Vue SPA to running container**

```bash
podman cp /Users/chance/git/opennms/ui/src/main/dist/. \
  test-opennms:/opt/opennms/jetty-webapps/opennms/ui/
```

Expected: files copied with no errors.

- [ ] **Step 3: Verify landing page redirect**

Open `http://localhost:8980/opennms/` — should redirect to `http://localhost:8980/opennms/ui/index.html#/dashboard`.

Note: The `index.jsp` redirect only applies if the webapp-rest module changes are compiled into the running container. Since the overlay image is pre-built, this JSP change needs the full overlay rebuilt. Skip this verification step until the overlay is rebuilt; focus on the Vue SPA behavior first.

- [ ] **Step 4: Verify Vue dashboard at correct URL**

Navigate to `http://localhost:8980/opennms/ui/index.html#/dashboard`.

Expected:
- Dashboard with Summary, Outages, Alarms, Nodes widgets is visible
- No 404 or blank page

- [ ] **Step 5: Verify JMX Config Generator route exists**

Navigate to `http://localhost:8980/opennms/ui/index.html#/jmx-config-generator`.

Expected: Step 1 connection form visible with "Service Name", "JMX Connection URL" fields and "Detect MBeans" button.

- [ ] **Step 6: Verify Vue Dashboard entry in side menu**

Open the side menu — confirm "Dashboard" appears under the Dashboards section and navigates to the Vue dashboard.

- [ ] **Step 7: Test connection form validation**

On the connection form:
- Clear the "Service Name" field → "Detect MBeans" button should be disabled
- Fill it back in → button should re-enable
- Check "Requires Authentication" → Username/Password fields should appear

- [ ] **Step 8: Rebuild overlay image with backend changes**

```bash
cd /Users/chance/git/opennms
./build-dark-mode-overlay.sh
```

Then restart the container with the new image and repeat Step 3 to verify the landing page redirect.

- [ ] **Step 9: Test full JMX detection against the running OpenNMS JMX port**

On the connection form, set:
- Service Name: `opennms-jvm`
- Connection URL: `service:jmx:rmi:///jndi/rmi://localhost:18980/jmxrmi`
- Skip Default JVM MBeans: checked

Click "Detect MBeans" → step 2 spinner should appear → after detection, step 3 MBean tree should appear with a list of MBeans.

- [ ] **Step 10: Test MBean selection and XML generation**

On step 3: select a few MBeans, expand one to see attributes, optionally edit an alias.

Click "Next" → step 4 should appear with a filename field defaulting to `opennms-jvm-jmx.xml`.

Click "Save to Server" → XML preview should appear, snackbar should confirm the saved path.

Verify the file exists in the container:
```bash
podman exec test-opennms ls /opt/opennms/etc/jmx-datacollection-config.d/
```

Expected: `opennms-jvm-jmx.xml` (or the filename you used) is listed.

- [ ] **Step 11: Test overwrite conflict flow**

Click "Start Over", run the wizard again with the same filename.

Click "Save to Server" → should show "File already exists. Overwrite?" inline.

Click "Overwrite" → should succeed and show the snackbar.

- [ ] **Step 12: Final commit**

```bash
git add -A
git commit -m "feat(jmx-config): Phase 2a complete — Vue wizard + REST backend for JMX config generator"
```
