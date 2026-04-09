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
package org.opennms.web.rest.support.mibcompiler;

import java.util.List;

public class MibJobStatus {

    public enum Status {
        PENDING, RUNNING, DONE, ERROR
    }

    public enum JobType {
        COMPILE, GENERATE_EVENTS, GENERATE_DATACOLLECTION
    }

    private Status status = Status.PENDING;
    private JobType jobType;
    private String mibName;
    private String error;
    private List<String> missingDependencies;

    // For generate-events results
    private String eventsXml;
    private int eventCount;

    // For generate-datacollection results
    private String datacollectionXml;
    private int groupCount;
    private String graphTemplates;

    private String suggestedFileName;

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public JobType getJobType() { return jobType; }
    public void setJobType(JobType jobType) { this.jobType = jobType; }

    public String getMibName() { return mibName; }
    public void setMibName(String mibName) { this.mibName = mibName; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public List<String> getMissingDependencies() { return missingDependencies; }
    public void setMissingDependencies(List<String> missingDependencies) { this.missingDependencies = missingDependencies; }

    public String getEventsXml() { return eventsXml; }
    public void setEventsXml(String eventsXml) { this.eventsXml = eventsXml; }

    public int getEventCount() { return eventCount; }
    public void setEventCount(int eventCount) { this.eventCount = eventCount; }

    public String getDatacollectionXml() { return datacollectionXml; }
    public void setDatacollectionXml(String datacollectionXml) { this.datacollectionXml = datacollectionXml; }

    public int getGroupCount() { return groupCount; }
    public void setGroupCount(int groupCount) { this.groupCount = groupCount; }

    public String getGraphTemplates() { return graphTemplates; }
    public void setGraphTemplates(String graphTemplates) { this.graphTemplates = graphTemplates; }

    public String getSuggestedFileName() { return suggestedFileName; }
    public void setSuggestedFileName(String suggestedFileName) { this.suggestedFileName = suggestedFileName; }
}
