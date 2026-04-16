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

import java.io.File;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.opennms.core.xml.JaxbUtils;
import org.opennms.features.mibcompiler.api.MibParser;
import org.opennms.features.mibcompiler.services.JsmiMibParser;
import org.opennms.features.mibcompiler.services.PrefabGraphDumper;
import org.opennms.netmgt.config.datacollection.DatacollectionGroup;
import org.opennms.netmgt.model.PrefabGraph;
import org.opennms.netmgt.xml.eventconf.Events;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Async job for MIB compilation and generation tasks.
 * Each job creates its own JsmiMibParser instance because it is NOT thread-safe.
 */
public class MibCompileJob implements Runnable {
    private static final Logger LOG = LoggerFactory.getLogger(MibCompileJob.class);
    private static final long TIMEOUT_SECONDS = 120L;
    private static final String MIB_EXTENSION = ".mib";

    private final MibJobStatus.JobType jobType;
    private final File compiledDir;
    private final File pendingDir;
    private final String filename;
    private final String ueiBase; // only used for GENERATE_EVENTS

    private volatile MibJobStatus.Status status = MibJobStatus.Status.PENDING;
    private volatile String mibName;
    private volatile String error;
    private volatile List<String> missingDependencies;
    private volatile String eventsXml;
    private volatile int eventCount;
    private volatile String datacollectionXml;
    private volatile int groupCount;
    private volatile String graphTemplates;
    private volatile String suggestedFileName;

    public MibCompileJob(MibJobStatus.JobType jobType, File pendingDir, File compiledDir,
                         String filename, String ueiBase) {
        this.jobType = jobType;
        this.pendingDir = pendingDir;
        this.compiledDir = compiledDir;
        this.filename = filename;
        this.ueiBase = ueiBase;
    }

    @Override
    public void run() {
        status = MibJobStatus.Status.RUNNING;
        ExecutorService inner = Executors.newSingleThreadExecutor();
        try {
            Future<?> future = inner.submit(this::doWork);
            future.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            LOG.warn("MIB {} job timed out after {}s for {}", jobType, TIMEOUT_SECONDS, filename);
            error = "Operation timed out after " + TIMEOUT_SECONDS + " seconds";
            status = MibJobStatus.Status.ERROR;
        } catch (ExecutionException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            LOG.warn("MIB {} job failed for {}: {}", jobType, filename, cause.getMessage(), cause);
            error = cause.getMessage();
            status = MibJobStatus.Status.ERROR;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            error = "Operation interrupted";
            status = MibJobStatus.Status.ERROR;
        } finally {
            inner.shutdownNow();
        }
    }

    private void doWork() {
        switch (jobType) {
            case COMPILE:
                doCompile();
                break;
            case GENERATE_EVENTS:
                doGenerateEvents();
                break;
            case GENERATE_DATACOLLECTION:
                doGenerateDataCollection();
                break;
        }
    }

    private void doCompile() {
        MibParser parser = new JsmiMibParser();
        parser.setMibDirectory(compiledDir);

        File mibFile = new File(pendingDir, filename);
        if (!mibFile.exists()) {
            error = "File not found in pending directory: " + filename;
            status = MibJobStatus.Status.ERROR;
            return;
        }

        if (parser.parseMib(mibFile)) {
            mibName = parser.getMibName();
            String targetName = mibName + MIB_EXTENSION;
            File targetFile = new File(compiledDir, targetName);

            try {
                Files.move(mibFile.toPath(), targetFile.toPath(), StandardCopyOption.ATOMIC_MOVE);
            } catch (Exception e) {
                // ATOMIC_MOVE may not be supported across filesystems; fall back to replace
                try {
                    Files.move(mibFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (Exception e2) {
                    error = "Failed to move compiled MIB: " + e2.getMessage();
                    status = MibJobStatus.Status.ERROR;
                    return;
                }
            }

            suggestedFileName = targetName;
            status = MibJobStatus.Status.DONE;
        } else {
            List<String> deps = parser.getMissingDependencies();
            if (deps != null && !deps.isEmpty()) {
                missingDependencies = deps;
                error = "Missing dependencies: " + deps;
            } else {
                error = parser.getFormattedErrors();
            }
            status = MibJobStatus.Status.ERROR;
        }
    }

    private void doGenerateEvents() {
        MibParser parser = new JsmiMibParser();
        parser.setMibDirectory(compiledDir);

        File mibFile = new File(compiledDir, filename);
        if (!mibFile.exists()) {
            error = "File not found in compiled directory: " + filename;
            status = MibJobStatus.Status.ERROR;
            return;
        }

        if (!parser.parseMib(mibFile)) {
            error = parser.getFormattedErrors();
            status = MibJobStatus.Status.ERROR;
            return;
        }

        mibName = parser.getMibName();
        Events events = parser.getEvents(ueiBase);

        if (events == null) {
            error = "Could not generate events: " + parser.getFormattedErrors();
            status = MibJobStatus.Status.ERROR;
            return;
        }

        if (events.getEvents().isEmpty()) {
            error = "The MIB does not contain any notification/trap";
            status = MibJobStatus.Status.ERROR;
            return;
        }

        eventCount = events.getEvents().size();
        eventsXml = JaxbUtils.marshal(events);
        suggestedFileName = filename.replaceFirst("\\..*$", ".events.xml");
        status = MibJobStatus.Status.DONE;
    }

    private void doGenerateDataCollection() {
        MibParser parser = new JsmiMibParser();
        parser.setMibDirectory(compiledDir);

        File mibFile = new File(compiledDir, filename);
        if (!mibFile.exists()) {
            error = "File not found in compiled directory: " + filename;
            status = MibJobStatus.Status.ERROR;
            return;
        }

        if (!parser.parseMib(mibFile)) {
            error = parser.getFormattedErrors();
            status = MibJobStatus.Status.ERROR;
            return;
        }

        mibName = parser.getMibName();
        DatacollectionGroup dcGroup = parser.getDataCollection();

        if (dcGroup == null) {
            error = "Could not generate data collection: " + parser.getFormattedErrors();
            status = MibJobStatus.Status.ERROR;
            return;
        }

        if (dcGroup.getGroups().isEmpty()) {
            error = "The MIB does not contain any metric for data collection";
            status = MibJobStatus.Status.ERROR;
            return;
        }

        groupCount = dcGroup.getGroups().size();
        datacollectionXml = JaxbUtils.marshal(dcGroup);
        suggestedFileName = filename.replaceFirst("\\..*$", ".xml");

        // Generate graph templates
        List<PrefabGraph> graphs = parser.getPrefabGraphs();
        if (graphs != null && !graphs.isEmpty()) {
            try {
                StringWriter writer = new StringWriter();
                new PrefabGraphDumper().dump(graphs, writer);
                graphTemplates = writer.toString();
            } catch (Exception e) {
                LOG.warn("Failed to generate graph templates for {}: {}", filename, e.getMessage());
                // Non-fatal — datacollection XML is still valid
            }
        }

        status = MibJobStatus.Status.DONE;
    }

    // Accessors for job manager to build status response
    public MibJobStatus.Status getStatus() { return status; }
    public MibJobStatus.JobType getJobType() { return jobType; }
    public String getMibName() { return mibName; }
    public String getError() { return error; }
    public List<String> getMissingDependencies() { return missingDependencies; }
    public String getEventsXml() { return eventsXml; }
    public int getEventCount() { return eventCount; }
    public String getDatacollectionXml() { return datacollectionXml; }
    public int getGroupCount() { return groupCount; }
    public String getGraphTemplates() { return graphTemplates; }
    public String getSuggestedFileName() { return suggestedFileName; }
}
