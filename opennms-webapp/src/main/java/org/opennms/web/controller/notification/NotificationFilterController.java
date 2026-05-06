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
package org.opennms.web.controller.notification;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.opennms.core.utils.WebSecurityUtils;
import org.opennms.netmgt.dao.api.NodeDao;
import org.opennms.netmgt.model.OnmsNode;
import org.opennms.web.event.Event;
import org.opennms.web.event.WebEventRepository;
import org.opennms.web.event.filter.EventCriteria;
import org.opennms.web.event.filter.EventIdListFilter;
import org.opennms.web.filter.Filter;
import org.opennms.web.notification.AcknowledgeType;
import org.opennms.web.notification.NoticeQueryParms;
import org.opennms.web.notification.NoticeUtil;
import org.opennms.web.notification.Notification;
import org.opennms.web.notification.SortStyle;
import org.opennms.web.notification.WebNotificationRepository;
import org.opennms.web.notification.filter.NotificationCriteria;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.util.Assert;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.AbstractController;

/**
 * <p>NotificationFilterController class.</p>
 *
 * @author ranger
 * @version $Id: $
 * @since 1.8.1
 */
public class NotificationFilterController extends AbstractController implements InitializingBean {

    /** Constant <code>DEFAULT_MULTIPLE=0</code> */
    public static final int DEFAULT_MULTIPLE = 0;

    private String m_successView;
    private Integer m_defaultShortLimit;
    private Integer m_defaultLongLimit;
    private SortStyle m_defaultSortStyle = SortStyle.ID;
    private AcknowledgeType m_defaultAckType = AcknowledgeType.UNACKNOWLEDGED;

    private WebEventRepository m_webEventRepository;
    private WebNotificationRepository m_webNotificationRepository;
    private NodeDao m_nodeDao;

    /**
     * {@inheritDoc}
     *
     * Parses the query string to determine what types of notification filters to use
     * (for example, what to filter on or sort by), then does the database query
     * and then forwards the results to a JSP for display.
     */
    @Override
    protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/notifications");
        return null;
    }

    /**
     * <p>setDefaultShortLimit</p>
     *
     * @param limit a {@link java.lang.Integer} object.
     */
    public void setDefaultShortLimit(Integer limit) {
        m_defaultShortLimit = limit;
    }

    /**
     * <p>setDefaultLongLimit</p>
     *
     * @param limit a {@link java.lang.Integer} object.
     */
    public void setDefaultLongLimit(Integer limit) {
        m_defaultLongLimit = limit;
    }

    /**
     * <p>setDefaultSortStyle</p>
     *
     * @param sortStyle a {@link org.opennms.web.notification.SortStyle} object.
     */
    public void setDefaultSortStyle(SortStyle sortStyle) {
        m_defaultSortStyle = sortStyle;
    }

    /**
     * <p>setSuccessView</p>
     *
     * @param successView a {@link java.lang.String} object.
     */
    public void setSuccessView(String successView) {
        m_successView = successView;
    }

    /**
     * <p>setWebEventRepository</p>
     *
     * @param webEventRepository a {@link org.opennms.web.event.WebEventRepository} object.
     */
    public void setWebEventRepository(WebEventRepository webEventRepository) {
        m_webEventRepository = webEventRepository;
    }

    /**
     * <p>setWebNotificationRepository</p>
     *
     * @param webNotificationRepository a {@link org.opennms.web.notification.WebNotificationRepository} object.
     */
    public void setWebNotificationRepository(WebNotificationRepository webNotificationRepository) {
        m_webNotificationRepository = webNotificationRepository;
    }

    /**
     * <p>setNodeDao</p>
     *
     * @param nodeDao a {@link org.opennms.netmgt.dao.api.NodeDao} object.
     */
    public void setNodeDao(NodeDao nodeDao) {
        m_nodeDao = nodeDao;
    }

    /**
     * <p>afterPropertiesSet</p>
     */
    @Override
    public void afterPropertiesSet() {
        Assert.notNull(m_defaultShortLimit, "property defaultShortLimit must be set to a value greater than 0");
        Assert.isTrue(m_defaultShortLimit > 0, "property defaultShortLimit must be set to a value greater than 0");
        Assert.notNull(m_defaultLongLimit, "property defaultLongLimit must be set to a value greater than 0");
        Assert.isTrue(m_defaultLongLimit > 0, "property defaultLongLimit must be set to a value greater than 0");
        Assert.notNull(m_successView, "property successView must be set");
        Assert.notNull(m_webNotificationRepository, "webNotificationRepository must be set");
        Assert.notNull(m_webEventRepository, "webEventRepository must be set");
        Assert.notNull(m_nodeDao, "nodeDao must be set");
    }

}
