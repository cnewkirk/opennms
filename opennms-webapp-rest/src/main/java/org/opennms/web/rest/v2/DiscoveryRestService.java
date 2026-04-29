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

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementWrapper;
import javax.xml.bind.annotation.XmlRootElement;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.opennms.core.soa.ServiceRegistry;
import org.opennms.netmgt.config.DiscoveryConfigFactory;
import org.opennms.netmgt.config.discovery.DiscoveryConfiguration;
import org.opennms.netmgt.config.discovery.ExcludeRange;
import org.opennms.netmgt.config.discovery.ExcludeUrl;
import org.opennms.netmgt.config.discovery.IncludeRange;
import org.opennms.netmgt.config.discovery.IncludeUrl;
import org.opennms.netmgt.config.discovery.Specific;
import org.opennms.netmgt.discovery.DiscoveryTaskExecutor;
import org.opennms.netmgt.events.api.EventConstants;
import org.opennms.netmgt.events.api.EventProxy;
import org.opennms.netmgt.events.api.EventProxyException;
import org.opennms.netmgt.model.events.EventBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Basic Web Service using REST for submitting discovery tasks
 *
 * @author Christian Pape
 */
@Component
@Path("discovery")
@Tag(name = "Discovery", description = "Discovery API")
public class DiscoveryRestService {

    private static final Logger LOG = LoggerFactory.getLogger(org.opennms.web.rest.v2.DiscoveryRestService.class);

    @XmlRootElement(name = "discoveryConfiguration")
    public static class DiscoveryConfigurationDTO {

        @XmlRootElement
        public static class SpecificDTO {
            private String content;
            private String location;
            private Integer retries;
            private Long timeout;
            private String foreignSource;

            public SpecificDTO() {
            }

            public String getContent() {
                return content;
            }

            public void setContent(String content) {
                this.content = content;
            }

            public String getLocation() {
                return location;
            }

            public void setLocation(String location) {
                this.location = location;
            }

            public Integer getRetries() {
                return retries;
            }

            public void setRetries(Integer retries) {
                this.retries = retries;
            }

            public Long getTimeout() {
                return timeout;
            }

            public void setTimeout(Long timeout) {
                this.timeout = timeout;
            }

            public String getForeignSource() {
                return foreignSource;
            }

            public void setForeignSource(String foreignSource) {
                this.foreignSource = foreignSource;
            }
        }

        @XmlRootElement
        public static class IncludeRangeDTO {
            private String location = "Default";
            private Integer retries = 1;
            private Long timeout = 2000l;
            private String foreignSource;
            private String begin;
            private String end;

            public IncludeRangeDTO() {
            }

            public String getLocation() {
                return location;
            }

            public void setLocation(String location) {
                this.location = location;
            }

            public Integer getRetries() {
                return retries;
            }

            public void setRetries(Integer retries) {
                this.retries = retries;
            }

            public Long getTimeout() {
                return timeout;
            }

            public void setTimeout(Long timeout) {
                this.timeout = timeout;
            }

            public String getForeignSource() {
                return foreignSource;
            }

            public void setForeignSource(String foreignSource) {
                this.foreignSource = foreignSource;
            }

            public String getBegin() {
                return begin;
            }

            public void setBegin(String begin) {
                this.begin = begin;
            }

            public String getEnd() {
                return end;
            }

            public void setEnd(String end) {
                this.end = end;
            }
        }

        @XmlRootElement
        public static class ExcludeRangeDTO {
            private String begin;
            private String end;
            private String location;

            public ExcludeRangeDTO() {
            }

            public String getBegin() {
                return begin;
            }

            public void setBegin(String begin) {
                this.begin = begin;
            }

            public String getEnd() {
                return end;
            }

            public void setEnd(String end) {
                this.end = end;
            }

            public String getLocation() {
                return location;
            }

            public void setLocation(String location) {
                this.location = location;
            }
        }

        @XmlRootElement
        public static class IncludeUrlDTO {
            private String content;
            private String location = "Default";
            private Integer retries = 1;
            private Long timeout = 2000l;
            private String foreignSource;

            public IncludeUrlDTO() {
            }

            public String getContent() {
                return content;
            }

            public void setContent(String content) {
                this.content = content;
            }

            public String getLocation() {
                return location;
            }

            public void setLocation(String location) {
                this.location = location;
            }

            public Integer getRetries() {
                return retries;
            }

            public void setRetries(Integer retries) {
                this.retries = retries;
            }

            public Long getTimeout() {
                return timeout;
            }

            public void setTimeout(Long timeout) {
                this.timeout = timeout;
            }

            public String getForeignSource() {
                return foreignSource;
            }

            public void setForeignSource(String foreignSource) {
                this.foreignSource = foreignSource;
            }
        }

        @XmlRootElement
        public static class ExcludeUrlDTO {
            private String content;
            private String location = "Default";
            private String foreignSource;

            public ExcludeUrlDTO() {
            }

            public String getContent() {
                return content;
            }

            public void setContent(String content) {
                this.content = content;
            }

            public String getLocation() {
                return location;
            }

            public void setLocation(String location) {
                this.location = location;
            }

            public String getForeignSource() {
                return foreignSource;
            }

            public void setForeignSource(String foreignSource) {
                this.foreignSource = foreignSource;
            }
        }

        private String location = "Default";
        private Integer retries = 1;
        private Long timeout = 2000l;
        private String foreignSource;
        private Integer chunkSize = 100;
        private Long initialSleepTime = (long) DiscoveryConfigFactory.DEFAULT_INITIAL_SLEEP_TIME;
        private Long restartSleepTime = (long) DiscoveryConfigFactory.DEFAULT_RESTART_SLEEP_TIME;

        private List<SpecificDTO> specificDTOList = new ArrayList<>();
        private List<IncludeRangeDTO> includeRangeDTOList = new ArrayList<>();
        private List<ExcludeRangeDTO> excludeRangeDTOList = new ArrayList<>();
        private List<IncludeUrlDTO> includeUrlDTOList = new ArrayList<>();
        private List<ExcludeUrlDTO> excludeUrlDTOList = new ArrayList<>();

        public String getLocation() {
            return location;
        }

        public void setLocation(String location) {
            this.location = location;
        }

        public Integer getRetries() {
            return retries;
        }

        public void setRetries(Integer retries) {
            this.retries = retries;
        }

        public Long getTimeout() {
            return timeout;
        }

        public void setTimeout(Long timeout) {
            this.timeout = timeout;
        }

        public String getForeignSource() {
            return foreignSource;
        }

        public void setForeignSource(String foreignSource) {
            this.foreignSource = foreignSource;
        }

        public Integer getChunkSize() {
            return chunkSize;
        }

        public void setChunkSize(Integer chunkSize) {
            this.chunkSize = chunkSize;
        }

        public Long getInitialSleepTime() {
            return initialSleepTime;
        }

        public void setInitialSleepTime(Long initialSleepTime) {
            this.initialSleepTime = initialSleepTime;
        }

        public Long getRestartSleepTime() {
            return restartSleepTime;
        }

        public void setRestartSleepTime(Long restartSleepTime) {
            this.restartSleepTime = restartSleepTime;
        }

        @XmlElementWrapper(name="specifics")
        @XmlElement(name="specific")
        public List<SpecificDTO> getSpecificDTOList() {
            return specificDTOList;
        }

        public void setSpecificDTOList(List<SpecificDTO> specificDTOList) {
            this.specificDTOList = specificDTOList;
        }

        @XmlElementWrapper(name="includeRanges")
        @XmlElement(name="includeRange")
        public List<IncludeRangeDTO> getIncludeRangeDTOList() {
            return includeRangeDTOList;
        }

        public void setIncludeRangeDTOList(List<IncludeRangeDTO> includeRangeDTOList) {
            this.includeRangeDTOList = includeRangeDTOList;
        }

        @XmlElementWrapper(name="excludeRanges")
        @XmlElement(name="excludeRange")
        public List<ExcludeRangeDTO> getExcludeRangeDTOList() {
            return excludeRangeDTOList;
        }

        public void setExcludeRangeDTOList(List<ExcludeRangeDTO> excludeRangeDTOList) {
            this.excludeRangeDTOList = excludeRangeDTOList;
        }

        @XmlElementWrapper(name="includeUrls")
        @XmlElement(name="includeUrl")
        public List<IncludeUrlDTO> getIncludeUrlDTOList() {
            return includeUrlDTOList;
        }

        public void setIncludeUrlDTOList(List<IncludeUrlDTO> includeUrlDTOList) {
            this.includeUrlDTOList = includeUrlDTOList;
        }

        @XmlElementWrapper(name="excludeUrls")
        @XmlElement(name="excludeUrl")
        public List<ExcludeUrlDTO> getExcludeUrlDTOList() {
            return excludeUrlDTOList;
        }

        public void setExcludeUrlDTOList(List<ExcludeUrlDTO> excludeUrlDTOList) {
            this.excludeUrlDTOList = excludeUrlDTOList;
        }
    }

    @Autowired
    ServiceRegistry serviceRegistry;

    @Autowired
    DiscoveryConfigFactory discoveryConfigFactory;

    @Autowired
    EventProxy eventProxy;

    @GET
    @Path("config")
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response getConfig() {
        try {
            discoveryConfigFactory.reload();
            return Response.ok(toDTO(discoveryConfigFactory.getConfiguration())).build();
        } catch (IOException e) {
            LOG.error("Failed to read discovery configuration", e);
            return Response.serverError().build();
        }
    }

    @PUT
    @Path("config")
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response saveConfig(DiscoveryConfigurationDTO dto) {
        try {
            // Load existing config to preserve required schema fields (e.g. packets-per-second)
            discoveryConfigFactory.reload();
            DiscoveryConfiguration config = discoveryConfigFactory.getConfiguration();
            // Update top-level fields
            config.setTimeout(dto.getTimeout());
            config.setRetries(dto.getRetries());
            config.setForeignSource(dto.getForeignSource());
            config.setLocation(dto.getLocation());
            config.setChunkSize(dto.getChunkSize());
            config.setInitialSleepTime(dto.getInitialSleepTime());
            config.setRestartSleepTime(dto.getRestartSleepTime());
            // Replace all list entries from DTO
            config.clearSpecifics();
            for (DiscoveryConfigurationDTO.SpecificDTO s : dto.getSpecificDTOList()) {
                Specific specific = new Specific();
                specific.setAddress(s.getContent());
                specific.setTimeout(s.getTimeout());
                specific.setRetries(s.getRetries());
                specific.setForeignSource(s.getForeignSource());
                specific.setLocation(s.getLocation());
                config.addSpecific(specific);
            }
            config.clearIncludeRanges();
            for (DiscoveryConfigurationDTO.IncludeRangeDTO ir : dto.getIncludeRangeDTOList()) {
                IncludeRange includeRange = new IncludeRange();
                includeRange.setBegin(ir.getBegin());
                includeRange.setEnd(ir.getEnd());
                includeRange.setTimeout(ir.getTimeout());
                includeRange.setRetries(ir.getRetries());
                includeRange.setForeignSource(ir.getForeignSource());
                includeRange.setLocation(ir.getLocation());
                config.addIncludeRange(includeRange);
            }
            config.clearExcludeRanges();
            for (DiscoveryConfigurationDTO.ExcludeRangeDTO er : dto.getExcludeRangeDTOList()) {
                ExcludeRange excludeRange = new ExcludeRange();
                excludeRange.setBegin(er.getBegin());
                excludeRange.setEnd(er.getEnd());
                if (er.getLocation() != null) excludeRange.setLocation(er.getLocation());
                config.addExcludeRange(excludeRange);
            }
            config.clearIncludeUrls();
            for (DiscoveryConfigurationDTO.IncludeUrlDTO iu : dto.getIncludeUrlDTOList()) {
                IncludeUrl includeUrl = new IncludeUrl();
                includeUrl.setUrl(iu.getContent());
                includeUrl.setTimeout(iu.getTimeout());
                includeUrl.setRetries(iu.getRetries());
                includeUrl.setForeignSource(iu.getForeignSource());
                includeUrl.setLocation(iu.getLocation());
                config.addIncludeUrl(includeUrl);
            }
            config.clearExcludeUrls();
            for (DiscoveryConfigurationDTO.ExcludeUrlDTO eu : dto.getExcludeUrlDTOList()) {
                ExcludeUrl excludeUrl = new ExcludeUrl();
                excludeUrl.setUrl(eu.getContent());
                excludeUrl.setForeignSource(eu.getForeignSource());
                excludeUrl.setLocation(eu.getLocation());
                config.addExcludeUrl(excludeUrl);
            }
            discoveryConfigFactory.saveConfiguration(config);
        } catch (IOException e) {
            LOG.error("Failed to save discovery configuration", e);
            return Response.serverError().build();
        }
        EventBuilder bldr = new EventBuilder(EventConstants.DISCOVERYCONFIG_CHANGED_EVENT_UEI, "DiscoveryRestService");
        try {
            eventProxy.send(bldr.getEvent());
        } catch (EventProxyException e) {
            LOG.warn("Could not send discoveryConfigChanged event", e);
        }
        return Response.noContent().build();
    }

    private DiscoveryConfigurationDTO toDTO(DiscoveryConfiguration config) {
        DiscoveryConfigurationDTO dto = new DiscoveryConfigurationDTO();
        dto.setLocation(config.getLocation().orElse("Default"));
        dto.setRetries(config.getRetries().orElse(DiscoveryConfigFactory.DEFAULT_RETRIES));
        dto.setTimeout(config.getTimeout().orElse(DiscoveryConfigFactory.DEFAULT_TIMEOUT));
        dto.setForeignSource(config.getForeignSource().orElse(null));
        dto.setChunkSize(config.getChunkSize().orElse(DiscoveryConfigFactory.DEFAULT_CHUNK_SIZE));
        dto.setInitialSleepTime(config.getInitialSleepTime().orElse((long) DiscoveryConfigFactory.DEFAULT_INITIAL_SLEEP_TIME));
        dto.setRestartSleepTime(config.getRestartSleepTime().orElse((long) DiscoveryConfigFactory.DEFAULT_RESTART_SLEEP_TIME));

        for (Specific s : config.getSpecifics()) {
            DiscoveryConfigurationDTO.SpecificDTO sdto = new DiscoveryConfigurationDTO.SpecificDTO();
            sdto.setContent(s.getAddress());
            sdto.setTimeout(s.getTimeout().orElse(null));
            sdto.setRetries(s.getRetries().orElse(null));
            sdto.setForeignSource(s.getForeignSource().orElse(null));
            sdto.setLocation(s.getLocation().orElse(null));
            dto.getSpecificDTOList().add(sdto);
        }

        for (IncludeRange ir : config.getIncludeRanges()) {
            DiscoveryConfigurationDTO.IncludeRangeDTO irdto = new DiscoveryConfigurationDTO.IncludeRangeDTO();
            irdto.setBegin(ir.getBegin());
            irdto.setEnd(ir.getEnd());
            irdto.setTimeout(ir.getTimeout().orElse(null));
            irdto.setRetries(ir.getRetries().orElse(null));
            irdto.setForeignSource(ir.getForeignSource().orElse(null));
            irdto.setLocation(ir.getLocation().orElse(null));
            dto.getIncludeRangeDTOList().add(irdto);
        }

        for (ExcludeRange er : config.getExcludeRanges()) {
            DiscoveryConfigurationDTO.ExcludeRangeDTO erdto = new DiscoveryConfigurationDTO.ExcludeRangeDTO();
            erdto.setBegin(er.getBegin());
            erdto.setEnd(er.getEnd());
            erdto.setLocation(er.getLocation().orElse(null));
            dto.getExcludeRangeDTOList().add(erdto);
        }

        for (IncludeUrl iu : config.getIncludeUrls()) {
            DiscoveryConfigurationDTO.IncludeUrlDTO iudto = new DiscoveryConfigurationDTO.IncludeUrlDTO();
            iudto.setContent(iu.getUrl().orElse(""));
            iudto.setTimeout(iu.getTimeout().orElse(null));
            iudto.setRetries(iu.getRetries().orElse(null));
            iudto.setForeignSource(iu.getForeignSource().orElse(null));
            iudto.setLocation(iu.getLocation().orElse(null));
            dto.getIncludeUrlDTOList().add(iudto);
        }

        for (ExcludeUrl eu : config.getExcludeUrls()) {
            DiscoveryConfigurationDTO.ExcludeUrlDTO eudto = new DiscoveryConfigurationDTO.ExcludeUrlDTO();
            eudto.setContent(eu.getUrl());
            eudto.setForeignSource(eu.getForeignSource().orElse(null));
            eudto.setLocation(eu.getLocation().orElse(null));
            dto.getExcludeUrlDTOList().add(eudto);
        }

        return dto;
    }

    @POST
    @Consumes({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response scan(DiscoveryConfigurationDTO discoveryConfigurationDTO) {

        DiscoveryConfiguration discoveryConfiguration = getDiscoveryConfig(discoveryConfigurationDTO);

        DiscoveryTaskExecutor discoveryTaskExecutor = serviceRegistry.findProvider(DiscoveryTaskExecutor.class);

        if (discoveryTaskExecutor != null) {
            discoveryTaskExecutor.handleDiscoveryTask(discoveryConfiguration);
        } else {
            LOG.warn("No DiscoveryTaskExecutor service is available");

            return Response.serverError().build();
        }

        return Response.ok().build();
    }

    private DiscoveryConfiguration getDiscoveryConfig(DiscoveryConfigurationDTO discoveryConfigurationDTO) {
        DiscoveryConfiguration discoveryConfiguration = new DiscoveryConfiguration();

        discoveryConfiguration.setTimeout(discoveryConfigurationDTO.getTimeout());
        discoveryConfiguration.setRetries(discoveryConfigurationDTO.getRetries());
        discoveryConfiguration.setForeignSource(discoveryConfigurationDTO.getForeignSource());
        discoveryConfiguration.setLocation(discoveryConfigurationDTO.getLocation());
        discoveryConfiguration.setChunkSize(discoveryConfigurationDTO.getChunkSize());

        for(DiscoveryConfigurationDTO.SpecificDTO specificDTO : discoveryConfigurationDTO.getSpecificDTOList()) {
            Specific specific = new Specific();
            specific.setAddress(specificDTO.getContent());
            specific.setTimeout(specificDTO.getTimeout());
            specific.setRetries(specificDTO.getRetries());
            specific.setForeignSource(specificDTO.getForeignSource());
            specific.setLocation(specificDTO.getLocation());
            discoveryConfiguration.addSpecific(specific);
        }

        for(DiscoveryConfigurationDTO.IncludeUrlDTO includeUrlDTO : discoveryConfigurationDTO.getIncludeUrlDTOList()){
            IncludeUrl includeUrl = new IncludeUrl();
            includeUrl.setUrl(includeUrlDTO.getContent());
            includeUrl.setTimeout(includeUrlDTO.getTimeout());
            includeUrl.setRetries(includeUrlDTO.getRetries());
            includeUrl.setForeignSource(includeUrlDTO.getForeignSource());
            includeUrl.setLocation(includeUrlDTO.getLocation());
            discoveryConfiguration.addIncludeUrl(includeUrl);
        }

        for(DiscoveryConfigurationDTO.ExcludeUrlDTO excludeUrlDTO : discoveryConfigurationDTO.getExcludeUrlDTOList()){
            ExcludeUrl excludeUrl = new ExcludeUrl();
            excludeUrl.setUrl(excludeUrlDTO.getContent());
            excludeUrl.setForeignSource(excludeUrlDTO.getForeignSource());
            excludeUrl.setLocation(excludeUrlDTO.getLocation());
            discoveryConfiguration.addExcludeUrl(excludeUrl);
        }

        for(DiscoveryConfigurationDTO.IncludeRangeDTO includeRangeDTO : discoveryConfigurationDTO.getIncludeRangeDTOList()){
            IncludeRange includeRange = new IncludeRange();
            includeRange.setBegin(includeRangeDTO.getBegin());
            includeRange.setEnd(includeRangeDTO.getEnd());
            includeRange.setTimeout(includeRangeDTO.getTimeout());
            includeRange.setRetries(includeRangeDTO.getRetries());
            includeRange.setForeignSource(includeRangeDTO.getForeignSource());
            includeRange.setLocation(includeRangeDTO.getLocation());
            discoveryConfiguration.addIncludeRange(includeRange);
        }

        for(DiscoveryConfigurationDTO.ExcludeRangeDTO excludeRangeDTO : discoveryConfigurationDTO.getExcludeRangeDTOList()) {
            ExcludeRange excludeRange = new ExcludeRange();
            excludeRange.setBegin(excludeRangeDTO.getBegin());
            excludeRange.setEnd(excludeRangeDTO.getEnd());
            if (excludeRangeDTO.getLocation() != null) {
                excludeRange.setLocation(excludeRangeDTO.getLocation());
            }
            discoveryConfiguration.addExcludeRange(excludeRange);
        }

        return discoveryConfiguration;
    }
}
