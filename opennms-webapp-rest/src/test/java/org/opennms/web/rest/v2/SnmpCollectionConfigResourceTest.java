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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.junit.Test;
import org.opennms.netmgt.config.datacollection.DatacollectionConfig;
import org.opennms.netmgt.config.datacollection.IncludeCollection;
import org.opennms.netmgt.config.datacollection.Rrd;
import org.opennms.netmgt.config.datacollection.SnmpCollection;
import org.opennms.web.rest.v2.SnmpCollectionConfigResource.SnmpCollectionDto;
import org.opennms.web.rest.v2.SnmpCollectionConfigResource.SnmpCollectionsDto;

public class SnmpCollectionConfigResourceTest {

    @Test
    public void toDtoRoundTrip() {
        DatacollectionConfig config = new DatacollectionConfig();
        config.setRrdRepository("/var/lib/opennms/rrd/snmp");

        SnmpCollection col = new SnmpCollection();
        col.setName("default");
        col.setSnmpStorageFlag("select");
        Rrd rrd = new Rrd();
        rrd.setStep(300);
        rrd.setRras(Arrays.asList("RRA:AVERAGE:0.5:1:2016", "RRA:MAX:0.5:288:366"));
        col.setRrd(rrd);
        IncludeCollection ic = new IncludeCollection();
        ic.setDataCollectionGroup("MIB-2");
        col.setIncludeCollections(Arrays.asList(ic));
        config.setSnmpCollections(Arrays.asList(col));

        SnmpCollectionsDto dto = SnmpCollectionConfigResource.toDto(config);

        assertNotNull(dto);
        assertEquals(1, dto.getSnmpCollections().size());
        SnmpCollectionDto cd = dto.getSnmpCollections().get(0);
        assertEquals("default", cd.getName());
        assertEquals("select", cd.getSnmpStorageFlag());
        assertEquals(300, cd.getRrdStep());
        assertEquals(Arrays.asList("RRA:AVERAGE:0.5:1:2016", "RRA:MAX:0.5:288:366"), cd.getRras());
        assertEquals(Arrays.asList("MIB-2"), cd.getIncludeCollections());
    }

    @Test
    public void fromDtoRoundTrip() {
        SnmpCollectionDto cd = new SnmpCollectionDto();
        cd.setName("default");
        cd.setSnmpStorageFlag("primary");
        cd.setRrdStep(300);
        cd.setRras(Arrays.asList("RRA:AVERAGE:0.5:1:2016"));
        cd.setIncludeCollections(Arrays.asList("Cisco", "Net-SNMP"));

        SnmpCollectionsDto dto = new SnmpCollectionsDto();
        dto.setSnmpCollections(Arrays.asList(cd));

        DatacollectionConfig config = new DatacollectionConfig();
        config.setRrdRepository("/var/lib/opennms/rrd/snmp");

        SnmpCollectionConfigResource.applyDto(config, dto);

        assertEquals(1, config.getSnmpCollections().size());
        SnmpCollection col = config.getSnmpCollections().get(0);
        assertEquals("default", col.getName());
        assertEquals("primary", col.getSnmpStorageFlag());
        assertEquals(300, (int) col.getRrd().getStep());
        assertEquals(Arrays.asList("RRA:AVERAGE:0.5:1:2016"), col.getRrd().getRras());
        List<String> groups = col.getIncludeCollections().stream()
                .map(IncludeCollection::getDataCollectionGroup)
                .collect(Collectors.toList());
        assertEquals(Arrays.asList("Cisco", "Net-SNMP"), groups);
    }
}
