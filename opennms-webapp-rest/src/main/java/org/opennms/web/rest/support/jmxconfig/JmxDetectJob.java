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
                String typeStr = attrib.getType() != null ? attrib.getType().getName() : "gauge";
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
