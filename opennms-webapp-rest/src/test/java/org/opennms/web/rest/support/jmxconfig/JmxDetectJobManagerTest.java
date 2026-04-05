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
package org.opennms.web.rest.support.jmxconfig;

import static org.junit.Assert.*;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class JmxDetectJobManagerTest {

    private JmxDetectJobManager manager;

    @Before
    public void setUp() {
        manager = new JmxDetectJobManager();
        manager.init();
    }

    @After
    public void tearDown() {
        manager.destroy();
    }

    @Test
    public void submitReturnsUniqueIds() {
        DetectRequest req = new DetectRequest();
        String id1 = manager.submit(req);
        String id2 = manager.submit(req);
        assertNotNull(id1);
        assertNotNull(id2);
        assertNotEquals(id1, id2);
    }

    @Test
    public void getStatusReturnsNullForUnknownId() {
        assertNull(manager.getStatus("nonexistent-id"));
    }

    @Test
    public void getStatusReturnsJobForKnownId() {
        DetectRequest req = new DetectRequest();
        String id = manager.submit(req);
        DetectJobStatus status = manager.getStatus(id);
        assertNotNull(status);
    }

    @Test
    public void expiredJobsAreRemovedAfterTtl() throws InterruptedException {
        JmxDetectJobManager shortTtlManager = new JmxDetectJobManager(100L); // 100ms TTL
        shortTtlManager.init();
        try {
            DetectRequest req = new DetectRequest();
            String id = shortTtlManager.submit(req);
            Thread.sleep(200);
            shortTtlManager.cleanExpiredJobs();
            assertNull(shortTtlManager.getStatus(id));
        } finally {
            shortTtlManager.destroy();
        }
    }
}
