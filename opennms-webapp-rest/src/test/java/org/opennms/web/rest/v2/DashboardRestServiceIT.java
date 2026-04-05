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

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import javax.ws.rs.core.MediaType;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.opennms.core.test.MockLogAppender;
import org.opennms.core.test.OpenNMSJUnit4ClassRunner;
import org.opennms.core.test.db.annotations.JUnitTemporaryDatabase;
import org.opennms.core.test.rest.AbstractSpringJerseyRestTestCase;
import org.opennms.test.JUnitConfigurationEnvironment;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.web.WebAppConfiguration;

@RunWith(OpenNMSJUnit4ClassRunner.class)
@WebAppConfiguration
@ContextConfiguration(locations={
        "classpath:/META-INF/opennms/applicationContext-soa.xml",
        "classpath:/META-INF/opennms/applicationContext-commonConfigs.xml",
        "classpath:/META-INF/opennms/applicationContext-minimal-conf.xml",
        "classpath:/META-INF/opennms/applicationContext-dao.xml",
        "classpath:/META-INF/opennms/applicationContext-mockConfigManager.xml",
        "classpath*:/META-INF/opennms/component-service.xml",
        "classpath*:/META-INF/opennms/component-dao.xml",
        "classpath:/META-INF/opennms/applicationContext-databasePopulator.xml",
        "classpath:/META-INF/opennms/mockEventIpcManager.xml",
        "file:src/main/webapp/WEB-INF/applicationContext-svclayer.xml",
        "file:src/main/webapp/WEB-INF/applicationContext-cxf-common.xml"
})
@JUnitConfigurationEnvironment(systemProperties={
        "org.apache.cxf.Logger=org.apache.cxf.common.logging.Slf4jLogger",
        "org.opennms.timeseries.strategy=integration"
})
@JUnitTemporaryDatabase
public class DashboardRestServiceIT extends AbstractSpringJerseyRestTestCase {

    public DashboardRestServiceIT() {
        super(CXF_REST_V2_CONTEXT_PATH);
    }

    @Override
    protected void afterServletStart() throws Exception {
        MockLogAppender.setupLogging(true, "DEBUG");
    }

    @Test
    public void testCreateAndRetrieve() throws Exception {
        // POST — create a new dashboard
        final String body = "{\"name\":\"My Dashboard\",\"description\":\"test\",\"spec\":\"{\\\"panels\\\":[]}\"}";
        final MockHttpServletResponse postResponse = sendData(POST, MediaType.APPLICATION_JSON, "/dashboards", body, 201);

        final String location = postResponse.getHeader("Location");
        assertNotNull("Location header must be present after POST", location);
        assertTrue("Location should contain /dashboards/", location.contains("/dashboards/"));

        // Extract the dashboard ID from the Location header
        final String id = location.substring(location.lastIndexOf('/') + 1);

        // GET by ID — full payload including spec
        final String json = sendRequest(GET, "/dashboards/" + id, 200);
        assertThat(json, containsString("My Dashboard"));
        assertThat(json, containsString("panels"));

        // GET list — summaries only, spec must be absent
        final String list = sendRequest(GET, "/dashboards", 200);
        assertThat(list, containsString("My Dashboard"));
        assertThat(list, not(containsString("panels")));
    }

    @Test
    public void testUpdateAndDelete() throws Exception {
        // Create
        final String body = "{\"name\":\"ToUpdate\",\"spec\":\"{}\"}";
        final MockHttpServletResponse postResponse = sendData(POST, MediaType.APPLICATION_JSON, "/dashboards", body, 201);

        final String location = postResponse.getHeader("Location");
        assertNotNull("Location header must be present after POST", location);
        final String id = location.substring(location.lastIndexOf('/') + 1);

        // PUT — replace the dashboard
        final String updated = "{\"name\":\"Updated\",\"spec\":\"{\\\"v\\\":2}\"}";
        sendData(PUT, MediaType.APPLICATION_JSON, "/dashboards/" + id, updated, 200);

        // Verify the update
        final String json = sendRequest(GET, "/dashboards/" + id, 200);
        assertThat(json, containsString("Updated"));

        // DELETE
        sendRequest(DELETE, "/dashboards/" + id, 204);

        // Confirm gone
        sendRequest(GET, "/dashboards/" + id, 404);
    }

    @Test
    public void testCreateBadRequest() throws Exception {
        // Missing spec — should return 400
        final String noSpec = "{\"name\":\"NoSpec\"}";
        sendData(POST, MediaType.APPLICATION_JSON, "/dashboards", noSpec, 400);

        // Missing name — should return 400
        final String noName = "{\"spec\":\"{}\"}";
        sendData(POST, MediaType.APPLICATION_JSON, "/dashboards", noName, 400);
    }

    @Test
    public void testGetNotFound() throws Exception {
        sendRequest(GET, "/dashboards/does-not-exist", 404);
    }
}
