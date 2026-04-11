package org.opennms.web.rest.v2;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.Collections;

import org.junit.Test;
import org.opennms.netmgt.config.EnhancedLinkdConfig;
import org.opennms.netmgt.config.api.CollectdConfigFactory;
import org.opennms.netmgt.config.api.DataCollectionConfigDao;
import org.opennms.netmgt.config.collectd.Package;
import org.opennms.netmgt.config.collectd.Service;
import org.opennms.web.rest.v2.MeasurementIntervalsRestService.IntervalsDto;

public class MeasurementIntervalsRestServiceTest {

    /**
     * When two packages both define SNMP with different intervals, the response
     * must use the minimum so the UI cache TTL never outlasts the shortest cycle.
     */
    @Test
    public void minimumAcrossPackages() {
        Service svc1 = new Service();
        svc1.setName("SNMP");
        svc1.setInterval(30000L);

        Service svc2 = new Service();
        svc2.setName("SNMP");
        svc2.setInterval(300000L);

        Package pkg1 = new Package();
        pkg1.setName("pkg1");
        pkg1.addService(svc1);

        Package pkg2 = new Package();
        pkg2.setName("pkg2");
        pkg2.addService(svc2);

        CollectdConfigFactory collectd = mock(CollectdConfigFactory.class);
        when(collectd.getPackages()).thenReturn(Arrays.asList(pkg1, pkg2));

        IntervalsDto dto = MeasurementIntervalsRestService.buildDto(collectd, null, null);

        assertNotNull(dto.collection);
        assertEquals(30000L, (long) dto.collection.get("SNMP"));
        assertNull("enlinkd should be null when bean is null", dto.enlinkd);
        assertEquals("rrdStep should be 0 when dcDao is null", 0, dto.rrdStep);
    }

    /**
     * When EnhancedLinkdConfig is available all six protocol intervals appear in the map.
     */
    @Test
    public void enlinkdIntervals() {
        EnhancedLinkdConfig enlinkd = mock(EnhancedLinkdConfig.class);
        when(enlinkd.getLldpRescanInterval()).thenReturn(3600000L);
        when(enlinkd.getOspfRescanInterval()).thenReturn(7200000L);
        when(enlinkd.getIsisRescanInterval()).thenReturn(1800000L);
        when(enlinkd.getCdpRescanInterval()).thenReturn(3600000L);
        when(enlinkd.getBridgeRescanInterval()).thenReturn(900000L);
        when(enlinkd.getTopologyInterval()).thenReturn(30000L);

        IntervalsDto dto = MeasurementIntervalsRestService.buildDto(null, null, enlinkd);

        assertNotNull(dto.enlinkd);
        assertEquals(3600000L, (long) dto.enlinkd.get("lldp"));
        assertEquals(7200000L, (long) dto.enlinkd.get("ospf"));
        assertEquals(1800000L, (long) dto.enlinkd.get("isis"));
        assertEquals(3600000L, (long) dto.enlinkd.get("cdp"));
        assertEquals(900000L,  (long) dto.enlinkd.get("bridge"));
        assertEquals(30000L,   (long) dto.enlinkd.get("topology"));
        assertNull("collection should be null when collectd bean is null", dto.collection);
        assertEquals(0, dto.rrdStep);
    }

    /**
     * When all three beans are null, collection and enlinkd sections are null
     * (omitted by @JsonInclude(NON_NULL)) and rrdStep is 0.
     */
    @Test
    public void nullBeansReturnEmptySections() {
        IntervalsDto dto = MeasurementIntervalsRestService.buildDto(null, null, null);

        assertNull(dto.collection);
        assertNull(dto.enlinkd);
        assertEquals(0, dto.rrdStep);
    }

    /**
     * When collectd returns no packages the collection map is present but empty.
     */
    @Test
    public void emptyPackagesReturnEmptyCollection() {
        CollectdConfigFactory collectd = mock(CollectdConfigFactory.class);
        when(collectd.getPackages()).thenReturn(Collections.emptyList());

        IntervalsDto dto = MeasurementIntervalsRestService.buildDto(collectd, null, null);

        assertNotNull(dto.collection);
        assertEquals(0, dto.collection.size());
    }
}
