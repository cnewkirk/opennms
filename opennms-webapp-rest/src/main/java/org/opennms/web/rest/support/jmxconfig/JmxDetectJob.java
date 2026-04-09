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
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

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
    private static final long TIMEOUT_SECONDS = 120L;

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
        ExecutorService inner = Executors.newSingleThreadExecutor();
        try {
            Future<?> future = inner.submit(this::doDetect);
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            LOG.warn("JMX detection timed out after {}s for {}", TIMEOUT_SECONDS, request.getConnection());
            error = "JMX detection timed out after " + TIMEOUT_SECONDS + " seconds";
            status = DetectJobStatus.Status.ERROR;
        } catch (ExecutionException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            LOG.warn("JMX detection failed for {}: {}", request.getConnection(), cause.getMessage(), cause);
            error = cause.getMessage();
            status = DetectJobStatus.Status.ERROR;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            error = "JMX detection interrupted";
            status = DetectJobStatus.Status.ERROR;
        } finally {
            inner.shutdownNow();
        }
    }

    private void doDetect() {
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
            throw new RuntimeException(e);
        }
    }

    private List<MBeanDto> convertToDto(JmxDatacollectionConfig config) {
        List<MBeanDto> dtos = new ArrayList<>();
        if (config == null || config.getJmxCollectionList() == null || config.getJmxCollectionList().isEmpty()) {
            return dtos;
        }
        final var collection = config.getJmxCollectionList().get(0);
        if (collection == null || collection.getMbeans() == null) {
            return dtos;
        }
        for (Mbean mbean : collection.getMbeans()) {
            MBeanDto dto = new MBeanDto(mbean.getObjectname(), mbean.getName());
            if (mbean.getAttribList() != null) {
                for (Attrib attrib : mbean.getAttribList()) {
                    String typeStr = attrib.getType() != null ? attrib.getType().getName() : "gauge";
                    dto.getAttributes().add(new MBeanAttributeDto(attrib.getName(), attrib.getAlias(), typeStr));
                }
            }
            // Phase 2a: only handles simple Attrib; CompAttrib (composite) deferred to Phase 2b
            dtos.add(dto);
        }
        return dtos;
    }

    public DetectJobStatus.Status getStatus() { return status; }
    public List<MBeanDto> getResult() { return result; }
    public String getError() { return error; }
}
