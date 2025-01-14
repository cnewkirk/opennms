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
package org.opennms.netmgt.dao.support;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.opennms.core.utils.InetAddressUtils;
import org.opennms.netmgt.collection.support.builder.PerspectiveResponseTimeResource;
import org.opennms.netmgt.dao.api.MonitoredServiceDao;
import org.opennms.netmgt.model.OnmsApplication;
import org.opennms.netmgt.model.OnmsMonitoredService;
import org.opennms.netmgt.model.OnmsOutage;
import org.opennms.netmgt.model.monitoringLocations.OnmsMonitoringLocation;
import org.opennms.netmgt.model.perspectivepolling.ApplicationServiceStatus;
import org.opennms.netmgt.model.perspectivepolling.ApplicationStatus;
import org.opennms.netmgt.model.perspectivepolling.Location;

import com.google.common.base.MoreObjects;

public class ApplicationStatusUtil {
    static class DowntimeInterval {
        public long start, end;

        public DowntimeInterval(final OnmsOutage onmsOutage, long start, long end) {
            this.start = onmsOutage.getIfLostService().getTime();

            if (this.start < start) {
                this.start = start;
            }

            this.end = onmsOutage.getIfRegainedService() != null ? onmsOutage.getIfRegainedService().getTime() : end;

            if (this.end > end) {
                this.end = end;
            }
        }

        @Override
        public String toString() {
            return MoreObjects.toStringHelper(this)
                    .add("start", start)
                    .add("end", end)
                    .toString();
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            DowntimeInterval that = (DowntimeInterval) o;
            return start == that.start &&
                    end == that.end;
        }

        @Override
        public int hashCode() {
            return Objects.hash(start, end);
        }
    }

    private static List<DowntimeInterval> mergeDowntimeIntervals(final List<DowntimeInterval> intervals) {
        final List<DowntimeInterval> resultList = new ArrayList<>();

        Collections.sort(intervals, (DowntimeInterval donwtimeInterval1, DowntimeInterval donwtimeInterval2) -> {
            return Long.signum(donwtimeInterval1.start - donwtimeInterval2.start) != 0 ? Long.signum(donwtimeInterval1.start - donwtimeInterval2.start) : Long.signum(donwtimeInterval1.end - donwtimeInterval2.end);
        });

        for (int i = 0; i < intervals.size(); ++i) {
            final DowntimeInterval mergedInterval = intervals.get(i);

            ++i;
            while (i < intervals.size() && intervalsOverlap(mergedInterval, intervals.get(i))) {
                mergedInterval.start = Math.min(mergedInterval.start, intervals.get(i).start);
                mergedInterval.end = Math.max(mergedInterval.end, intervals.get(i).end);
                ++i;
            }
            --i;

            resultList.add(mergedInterval);
        }

        return resultList;
    }

    private static boolean intervalsOverlap(final DowntimeInterval downtimeInterval1, final DowntimeInterval downtimeInterval2) {
        return !(Math.max(downtimeInterval1.start, downtimeInterval2.start) > Math.min(downtimeInterval1.end, downtimeInterval2.end));
    }

    private static double calculateApplicationPercentageUptime(final List<DowntimeInterval> intervals, final long start, final long end) {
        double totalTimeMillis = end - start;
        double uptimeMillis = totalTimeMillis;
        for(final DowntimeInterval interval : intervals) {
            uptimeMillis -= (Math.min(interval.end, end)-Math.max(interval.start, start));
        }
        return uptimeMillis / totalTimeMillis;
    }

    public static ApplicationStatus buildApplicationStatus(final OnmsApplication onmsApplication, final Collection<OnmsOutage> onmsOutages, final long start, final long end) {
        final Map<OnmsMonitoringLocation, List<DowntimeInterval>> m = new HashMap<>();

        for (final OnmsMonitoringLocation onmsMonitoringLocation : onmsApplication.getPerspectiveLocations()) {
            m.put(onmsMonitoringLocation, new ArrayList<>());
        }

        for(final OnmsOutage onmsOutage : onmsOutages) {
            m.get(onmsOutage.getPerspective()).add(new DowntimeInterval(onmsOutage, start, end));
        }

        final ApplicationStatus applicationStatus = new ApplicationStatus();
        applicationStatus.setStart(start);
        applicationStatus.setEnd(end);
        applicationStatus.setApplicationId(onmsApplication.getId());
        applicationStatus.setOverallStatus(100.0 * calculateApplicationPercentageUptime(
                mergeDowntimeIntervals(
                        m.values().stream()
                                .flatMap(e -> e.stream())
                                .collect(Collectors.toList())
                ), start, end)
        );

        for (final OnmsMonitoringLocation onmsMonitoringLocation : onmsApplication.getPerspectiveLocations()) {
            final Location location = new Location();
            location.setName(onmsMonitoringLocation.getLocationName());

            final List<DowntimeInterval> mergedDowntimeIntervals = mergeDowntimeIntervals(m.get(onmsMonitoringLocation));

            location.setAggregatedStatus(100.0 * calculateApplicationPercentageUptime(mergedDowntimeIntervals, start, end));
            applicationStatus.getLocations().add(location);
        }
        return applicationStatus;
    }

    public static ApplicationServiceStatus buildApplicationServiceStatus(final MonitoredServiceDao monitoredServiceDao, final OnmsApplication onmsApplication, final Integer monitoredServiceId, final Collection<OnmsOutage> onmsOutages, final long start, final long end) {
        final OnmsMonitoredService onmsMonitoredService = monitoredServiceDao.get(monitoredServiceId);

        final Map<OnmsMonitoringLocation, List<DowntimeInterval>> m = new HashMap<>();

        for (final OnmsMonitoringLocation onmsMonitoringLocation : onmsApplication.getPerspectiveLocations()) {
            m.put(onmsMonitoringLocation, new ArrayList<>());
        }

        for(final OnmsOutage onmsOutage : onmsOutages) {
            if (monitoredServiceId.equals(onmsOutage.getMonitoredService().getId())) {
                m.get(onmsOutage.getPerspective()).add(new DowntimeInterval(onmsOutage, start, end));
            }
        }

        final ApplicationServiceStatus applicationServiceStatus = new ApplicationServiceStatus();
        applicationServiceStatus.setStart(start);
        applicationServiceStatus.setEnd(end);
        applicationServiceStatus.setApplicationId(onmsApplication.getId());
        applicationServiceStatus.setMonitoredServiceId(monitoredServiceId);

        for (final OnmsMonitoringLocation onmsMonitoringLocation : onmsApplication.getPerspectiveLocations()) {
            final Location location = new Location();
            location.setName(onmsMonitoringLocation.getLocationName());

            final List<DowntimeInterval> mergedDowntimeIntervals = mergeDowntimeIntervals(m.get(onmsMonitoringLocation));

            location.setAggregatedStatus(100.0 * calculateApplicationPercentageUptime(mergedDowntimeIntervals, start, end));
            final PerspectiveResponseTimeResource remoteLatencyResource = new PerspectiveResponseTimeResource(location.getName(), InetAddressUtils.toIpAddrString(onmsMonitoredService.getIpAddress()), onmsMonitoredService.getServiceType().getName());
            location.setResponseResourceId(remoteLatencyResource.getInstance());
            applicationServiceStatus.getLocations().add(location);
        }

        return applicationServiceStatus;
    }
}
