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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.xml.bind.annotation.XmlAttribute;
import javax.xml.bind.annotation.adapters.XmlAdapter;

/**
 * JAXB adapter for marshaling/unmarshaling Map<String,String> to/from XML.
 */
public class StringMapAdapter extends XmlAdapter<StringMapAdapter.JaxbMap, Map<String, String>> {

    public static final class JaxbMap {
        public List<Entry> entry = new ArrayList<>();
    }

    public static final class Entry {
        @XmlAttribute
        public String key;

        @XmlAttribute
        public String value;
    }

    @Override
    public JaxbMap marshal(Map<String, String> v) throws Exception {
        JaxbMap retval = new JaxbMap();
        if (v != null) {
            for (String key : v.keySet()) {
                Entry entry = new Entry();
                entry.key = key;
                entry.value = v.get(key);
                retval.entry.add(entry);
            }
        }
        return retval;
    }

    @Override
    public Map<String, String> unmarshal(JaxbMap v) throws Exception {
        Map<String, String> retval = new HashMap<>();
        if (v != null && v.entry != null) {
            for (Entry entry : v.entry) {
                if (entry.key != null) {
                    retval.put(entry.key, entry.value != null ? entry.value : "");
                }
            }
        }
        return retval;
    }
}
