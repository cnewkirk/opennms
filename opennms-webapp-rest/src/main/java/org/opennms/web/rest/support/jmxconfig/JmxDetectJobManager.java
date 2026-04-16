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

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class JmxDetectJobManager {
    private static final Logger LOG = LoggerFactory.getLogger(JmxDetectJobManager.class);
    private static final long DEFAULT_TTL_MS = 5 * 60 * 1000L; // 5 minutes

    private final long ttlMs;
    private final Map<String, JobEntry> jobs = new ConcurrentHashMap<>();
    private ExecutorService executor;
    private ScheduledExecutorService cleaner;

    public JmxDetectJobManager() {
        this(DEFAULT_TTL_MS);
    }

    /** Package-visible constructor for testing with custom TTL. */
    JmxDetectJobManager(long ttlMs) {
        this.ttlMs = ttlMs;
    }

    @PostConstruct
    public void init() {
        executor = Executors.newFixedThreadPool(4);
        cleaner = Executors.newSingleThreadScheduledExecutor();
        cleaner.scheduleAtFixedRate(this::cleanExpiredJobs, 1, 1, TimeUnit.MINUTES);
    }

    @PreDestroy
    public void destroy() {
        executor.shutdownNow();
        cleaner.shutdownNow();
    }

    public String submit(DetectRequest request) {
        String jobId = UUID.randomUUID().toString();
        JmxDetectJob job = new JmxDetectJob(request);
        jobs.put(jobId, new JobEntry(job, Instant.now()));
        executor.submit(job);
        LOG.debug("Submitted JMX detection job {} for {}", jobId, request.getConnection());
        return jobId;
    }

    public DetectJobStatus getStatus(String jobId) {
        JobEntry entry = jobs.get(jobId);
        if (entry == null) {
            return null;
        }
        JmxDetectJob job = entry.job;
        DetectJobStatus status = new DetectJobStatus();
        status.setStatus(job.getStatus());
        if (job.getStatus() == DetectJobStatus.Status.DONE) {
            status.setMbeans(job.getResult());
        } else if (job.getStatus() == DetectJobStatus.Status.ERROR) {
            status.setError(job.getError());
        }
        return status;
    }

    /** Exposed for testing; normally called by scheduler. */
    void cleanExpiredJobs() {
        Instant cutoff = Instant.now().minusMillis(ttlMs);
        jobs.entrySet().removeIf(e -> e.getValue().submittedAt.isBefore(cutoff));
    }

    private static class JobEntry {
        final JmxDetectJob job;
        final Instant submittedAt;

        JobEntry(JmxDetectJob job, Instant submittedAt) {
            this.job = job;
            this.submittedAt = submittedAt;
        }
    }
}
