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

import java.util.ArrayList;
import java.util.List;

import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

@XmlRootElement(name = "wallboard")
public class WallboardEntry {

    private String title = "";
    private boolean defaultBoard = false;
    private List<DashletEntry> dashlets = new ArrayList<>();

    @XmlAttribute(name = "title")
    public String getTitle() {
        return title;
    }

    public void setTitle(String v) {
        this.title = v;
    }

    @XmlAttribute(name = "default")
    public boolean isDefault() {
        return defaultBoard;
    }

    public void setDefault(boolean v) {
        this.defaultBoard = v;
    }

    @XmlElement(name = "dashlet")
    public List<DashletEntry> getDashlets() {
        return dashlets;
    }

    public void setDashlets(List<DashletEntry> v) {
        this.dashlets = v;
    }
}
