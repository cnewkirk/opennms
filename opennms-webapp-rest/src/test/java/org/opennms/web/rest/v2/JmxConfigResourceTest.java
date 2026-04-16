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

import java.util.List;

import org.junit.Test;
import org.opennms.web.rest.support.jmxconfig.GenerateRequest;
import org.opennms.web.rest.support.jmxconfig.MBeanAttributeDto;
import org.opennms.web.rest.support.jmxconfig.MBeanDto;

public class JmxConfigResourceTest {

    @Test
    public void buildXmlContainsServiceName() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto mbean = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        MBeanAttributeDto attr = new MBeanAttributeDto("HeapMemoryUsage", "heapMemUsage", "gauge");
        attr.setInclude(true);
        mbean.getAttributes().add(attr);
        req.setMbeans(List.of(mbean));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue("XML should contain service name", xml.contains("myservice"));
        assertTrue("XML should contain object name", xml.contains("java.lang:type=Memory"));
        assertTrue("XML should contain alias", xml.contains("heapMemUsage"));
    }

    @Test
    public void buildXmlExcludesUnselectedAttributes() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto mbean = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        MBeanAttributeDto included = new MBeanAttributeDto("HeapMemoryUsage", "heapMemUsage", "gauge");
        included.setInclude(true);
        MBeanAttributeDto excluded = new MBeanAttributeDto("NonHeapMemoryUsage", "nonHeapMem", "gauge");
        excluded.setInclude(false);
        mbean.getAttributes().add(included);
        mbean.getAttributes().add(excluded);
        req.setMbeans(List.of(mbean));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue(xml.contains("heapMemUsage"));
        assertFalse(xml.contains("nonHeapMem"));
    }

    @Test
    public void buildXmlExcludesUnselectedMBeans() {
        GenerateRequest req = new GenerateRequest();
        req.setServiceName("myservice");

        MBeanDto included = new MBeanDto("java.lang:type=Memory", "JVM Memory");
        included.setInclude(true);
        MBeanDto excluded = new MBeanDto("java.lang:type=Threading", "JVM Threading");
        excluded.setInclude(false);
        req.setMbeans(List.of(included, excluded));

        String xml = JmxConfigResource.buildXml(req);
        assertTrue(xml.contains("java.lang:type=Memory"));
        assertFalse(xml.contains("java.lang:type=Threading"));
    }

    @Test
    public void sanitizeFilenameRejectsDotDot() {
        assertThrows(IllegalArgumentException.class,
            () -> JmxConfigResource.sanitizeFileName("../etc/passwd"));
    }

    @Test
    public void sanitizeFilenameRejectsSlash() {
        assertThrows(IllegalArgumentException.class,
            () -> JmxConfigResource.sanitizeFileName("sub/dir/file.xml"));
    }

    @Test
    public void sanitizeFilenameAcceptsValidName() {
        assertEquals("myservice-jmx.xml", JmxConfigResource.sanitizeFileName("myservice-jmx.xml"));
    }
}
