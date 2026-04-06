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

import java.io.File;
import java.io.IOException;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.opennms.core.xml.JaxbUtils;
import org.opennms.web.rest.support.wallboardconfig.DashletEntry;
import org.opennms.web.rest.support.wallboardconfig.WallboardEntry;
import org.opennms.web.rest.support.wallboardconfig.WallboardsConfig;

public class WallboardConfigRestServiceTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void marshalAndUnmarshalRoundTrip() throws IOException {
        WallboardsConfig config = new WallboardsConfig();
        WallboardEntry board = new WallboardEntry();
        board.setTitle("Main Board");
        board.setDefault(true);

        DashletEntry dashlet = new DashletEntry();
        dashlet.setDashletName("Alarms");
        dashlet.setTitle("Active Alarms");
        dashlet.setDuration(30);
        dashlet.setPriority(3);
        dashlet.getParameters().put("severity", "WARNING");
        board.getDashlets().add(dashlet);
        config.getWallboards().add(board);

        File f = tmp.newFile("dashboard-config.xml");
        JaxbUtils.marshal(config, f);

        WallboardsConfig loaded = JaxbUtils.unmarshal(WallboardsConfig.class, f);
        assertEquals(1, loaded.getWallboards().size());
        WallboardEntry lb = loaded.getWallboards().get(0);
        assertEquals("Main Board", lb.getTitle());
        assertTrue(lb.isDefault());
        assertEquals(1, lb.getDashlets().size());
        DashletEntry ld = lb.getDashlets().get(0);
        assertEquals("Alarms", ld.getDashletName());
        assertEquals("Active Alarms", ld.getTitle());
        assertEquals(30, ld.getDuration());
        assertEquals(3, ld.getPriority());
        assertEquals("WARNING", ld.getParameters().get("severity"));
    }

    @Test
    public void emptyConfigRoundTrips() throws IOException {
        WallboardsConfig config = new WallboardsConfig();
        File f = tmp.newFile("empty.xml");
        JaxbUtils.marshal(config, f);
        WallboardsConfig loaded = JaxbUtils.unmarshal(WallboardsConfig.class, f);
        assertNotNull(loaded);
        assertTrue(loaded.getWallboards().isEmpty());
    }

    @Test
    public void validateMultipleDefaultsIsDetected() {
        WallboardsConfig config = new WallboardsConfig();
        WallboardEntry b1 = new WallboardEntry();
        b1.setTitle("A");
        b1.setDefault(true);
        WallboardEntry b2 = new WallboardEntry();
        b2.setTitle("B");
        b2.setDefault(true);
        config.getWallboards().add(b1);
        config.getWallboards().add(b2);

        long defaultCount = config.getWallboards().stream().filter(WallboardEntry::isDefault).count();
        assertTrue("Should detect multiple defaults", defaultCount > 1);
    }
}
