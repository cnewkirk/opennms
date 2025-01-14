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
package org.opennms.netmgt.queued;

import java.util.Set;

import org.opennms.netmgt.daemon.AbstractServiceDaemon;
import org.opennms.netmgt.events.api.EventConstants;
import org.opennms.netmgt.events.api.EventIpcManager;
import org.opennms.netmgt.events.api.EventListener;
import org.opennms.netmgt.events.api.model.IEvent;
import org.opennms.netmgt.model.events.EventUtils;
import org.opennms.netmgt.rrd.RrdStrategy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

/**
 * <p>Queued class.</p>
 *
 * @author <a href="mailto:brozow@opennms.org">Mathew Brozowski</a>
 * @version $Id: $
 */
public class Queued extends AbstractServiceDaemon implements EventListener {
    
    private static final Logger LOG = LoggerFactory.getLogger(Queued.class);

    private static final String LOG4J_CATEGORY = "queued";
    
    private volatile EventIpcManager m_eventMgr; 

    /*
     * There are currently 2 possible strategies to be used here:
     * - QueuingRrdStrategy (the standard behavior)
     * - QueuingTcpRrdStrategy (the modified behavior when org.opennms.rrd.usetcp=true)
     * This is the reason why we should use an indirect reference, otherwise we will experiment NMS-4989
     */
    private volatile RrdStrategy<?,?> m_rrdStrategy;

    /**
     * <p>Constructor for Queued.</p>
     */
    public Queued() {
        super(LOG4J_CATEGORY);
    }
    
    /**
     * <p>setEventIpcManager</p>
     *
     * @param eventMgr a {@link org.opennms.netmgt.events.api.EventIpcManager} object.
     */
    public void setEventIpcManager(EventIpcManager eventMgr) {
        m_eventMgr = eventMgr;
    }
    
    /**
     * <p>getRrdStrategy</p>
     *
     * @return a {@link org.opennms.netmgt.rrd.RrdStrategy} object.
     */
    public RrdStrategy<?,?> getRrdStrategy() {
        return m_rrdStrategy;
    }

    /**
     * <p>setRrdStrategy</p>
     *
     * @param rrdStrategy a {@link org.opennms.netmgt.rrd.RrdStrategy} object.
     */
    public void setRrdStrategy(RrdStrategy<?,?> rrdStrategy) {
        m_rrdStrategy = rrdStrategy;
    }
    
    
    /** {@inheritDoc} */
    @Override
    protected void onInit() {
        Assert.state(m_eventMgr != null, "setEventIpcManager must be set");
        Assert.state(m_rrdStrategy != null, "rrdStrategy must be set");
        
        
        m_eventMgr.addEventListener(this, EventConstants.PROMOTE_QUEUE_DATA_UEI);
    }

    /** {@inheritDoc} */
    @Override
    public void onEvent(IEvent e) {
        String fileList = EventUtils.getParm(e, EventConstants.PARM_FILES_TO_PROMOTE);
        Set<String> files = commaDelimitedListToSet(fileList);

        logFilePromotion(files);
        
        m_rrdStrategy.promoteEnqueuedFiles(files);
    }

    private Set<String> commaDelimitedListToSet(String fileList) {
        return StringUtils.commaDelimitedListToSet(fileList);
    }
    
    private void logFilePromotion(Set<String> files) {
        if (!LOG.isDebugEnabled()) {
            return;
        }
        
        for(String file : files) {
            LOG.debug("Promoting file: {}", file);
        }
    }

    public static String getLoggingCateogy() {
        return LOG4J_CATEGORY;
    }
}
