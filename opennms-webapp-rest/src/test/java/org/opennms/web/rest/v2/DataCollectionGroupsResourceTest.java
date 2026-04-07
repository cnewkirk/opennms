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
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class DataCollectionGroupsResourceTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    // ── isValidFilename ──────────────────────────────────────────────────────

    @Test
    public void validFilenameAcceptsAlphanumericDotDash() {
        assertTrue(DataCollectionGroupsResource.isValidFilename("cisco.xml"));
        assertTrue(DataCollectionGroupsResource.isValidFilename("net-snmp.xml"));
        assertTrue(DataCollectionGroupsResource.isValidFilename("mib2_extended.xml"));
    }

    @Test
    public void validFilenameRejectsPathTraversal() {
        assertFalse(DataCollectionGroupsResource.isValidFilename("../etc/passwd"));
        assertFalse(DataCollectionGroupsResource.isValidFilename("/etc/passwd"));
        assertFalse(DataCollectionGroupsResource.isValidFilename("foo/bar.xml"));
    }

    @Test
    public void validFilenameRejectsNull() {
        assertFalse(DataCollectionGroupsResource.isValidFilename(null));
    }

    // ── extractGroupName ─────────────────────────────────────────────────────

    @Test
    public void extractGroupNameParsesValidXml() throws IOException {
        File f = tmp.newFile("cisco.xml");
        Files.writeString(f.toPath(),
            "<?xml version=\"1.0\"?>\n" +
            "<datacollection-group xmlns=\"http://xmlns.opennms.org/xsd/config/datacollection\" name=\"Cisco\">\n" +
            "</datacollection-group>");
        String name = DataCollectionGroupsResource.extractGroupName(f);
        assertEquals("Cisco", name);
    }

    @Test
    public void extractGroupNameReturnsNullForMalformedXml() throws IOException {
        File f = tmp.newFile("bad.xml");
        Files.writeString(f.toPath(), "<not valid xml at all <<>>");
        String name = DataCollectionGroupsResource.extractGroupName(f);
        assertNull(name);
    }

    // ── buildFileMeta ────────────────────────────────────────────────────────

    @Test
    public void buildFileMetaReturnsFilenameAndGroupName() throws IOException {
        File dir = tmp.newFolder("datacollection");
        File f = new File(dir, "mib2.xml");
        Files.writeString(f.toPath(),
            "<?xml version=\"1.0\"?>\n" +
            "<datacollection-group xmlns=\"http://xmlns.opennms.org/xsd/config/datacollection\" name=\"MIB-2\">\n" +
            "</datacollection-group>");

        DataCollectionGroupsResource.GroupFileMeta meta =
            DataCollectionGroupsResource.buildFileMeta(f);
        assertEquals("mib2.xml", meta.getFilename());
        assertEquals("MIB-2", meta.getGroupName());
    }
}
