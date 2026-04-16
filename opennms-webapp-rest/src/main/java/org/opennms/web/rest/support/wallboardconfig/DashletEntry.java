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
package org.opennms.web.rest.support.wallboardconfig;

import java.util.LinkedHashMap;
import java.util.Map;

import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.adapters.XmlJavaTypeAdapter;

@XmlRootElement(name = "dashlet")
public class DashletEntry {

    private String dashletName = "Undefined";
    private String title = "";
    private int duration = 15;
    private int priority = 5;
    private int boostDuration = 0;
    private int boostPriority = 0;
    private Map<String, String> parameters = new LinkedHashMap<>();

    @XmlAttribute(name = "dashlet")
    public String getDashletName() {
        return dashletName;
    }

    public void setDashletName(String v) {
        this.dashletName = v;
    }

    @XmlAttribute(name = "title")
    public String getTitle() {
        return title;
    }

    public void setTitle(String v) {
        this.title = v;
    }

    @XmlAttribute(name = "duration")
    public int getDuration() {
        return duration;
    }

    public void setDuration(int v) {
        this.duration = v;
    }

    @XmlAttribute(name = "priority")
    public int getPriority() {
        return priority;
    }

    public void setPriority(int v) {
        this.priority = v;
    }

    @XmlAttribute(name = "boostDuration")
    public int getBoostDuration() {
        return boostDuration;
    }

    public void setBoostDuration(int v) {
        this.boostDuration = v;
    }

    @XmlAttribute(name = "boostPriority")
    public int getBoostPriority() {
        return boostPriority;
    }

    public void setBoostPriority(int v) {
        this.boostPriority = v;
    }

    @XmlElement(name = "parameters")
    @XmlJavaTypeAdapter(StringMapAdapter.class)
    public Map<String, String> getParameters() {
        return parameters;
    }

    public void setParameters(Map<String, String> v) {
        this.parameters = v != null ? v : new LinkedHashMap<>();
    }
}
