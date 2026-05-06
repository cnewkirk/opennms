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
package org.opennms.web.controller.outage;

import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.opennms.core.utils.WebSecurityUtils;
import org.opennms.web.filter.Filter;
import org.opennms.web.outage.Outage;
import org.opennms.web.outage.OutageQueryParms;
import org.opennms.web.outage.OutageType;
import org.opennms.web.outage.OutageUtil;
import org.opennms.web.outage.SortStyle;
import org.opennms.web.outage.WebOutageRepository;
import org.opennms.web.outage.filter.OutageCriteria;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.util.Assert;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.AbstractController;

/**
 * A controller that handles querying the outages table by using filters to create an
 * outage list and and then forwards that outage list to a JSP for display.
 *
 * @author <a href="mailto:ranger@opennms.org">Benjamin Reed</a>
 * @author <a href="http://www.opennms.org/">OpenNMS</a>
 * @version $Id: $
 * @since 1.8.1
 */
public class OutageFilterController extends AbstractController implements InitializingBean {
    /** Constant <code>DEFAULT_MULTIPLE=0</code> */
    public static final int DEFAULT_MULTIPLE = 0;

    private String m_successView;

    private Integer m_defaultShortLimit;

    private Integer m_defaultLongLimit;
    
    private OutageType m_defaultOutageType = OutageType.CURRENT;

    private SortStyle m_defaultSortStyle = SortStyle.ID;

    private WebOutageRepository m_webOutageRepository;
    


    /**
     * {@inheritDoc}
     *
     * Parses the query string to determine what types of filters to use
     * (for example, what to filter on or sort by), then does the database query
     * (through the OutageFactory) and then forwards the results to a JSP for
     * display.
     *
     * <p>
     * Sets request attributes for the forwardee JSP (or whatever gets called).
     * </p>
     */
    @Override
    protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/outages");
        return null;
    }

    private Integer getDefaultShortLimit() {
        return m_defaultShortLimit;
    }

    /**
     * <p>setDefaultShortLimit</p>
     *
     * @param limit a {@link java.lang.Integer} object.
     */
    public void setDefaultShortLimit(Integer limit) {
        m_defaultShortLimit = limit;
    }

    private Integer getDefaultLongLimit() {
        return m_defaultLongLimit;
    }

    /**
     * <p>setDefaultLongLimit</p>
     *
     * @param limit a {@link java.lang.Integer} object.
     */
    public void setDefaultLongLimit(Integer limit) {
        m_defaultLongLimit = limit;
    }

    private String getSuccessView() {
        return m_successView;
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
     * <p>setWebOutageRepository</p>
     *
     * @param webOutageRepository a {@link org.opennms.web.outage.WebOutageRepository} object.
     */
    public void setWebOutageRepository(WebOutageRepository webOutageRepository) {
        m_webOutageRepository = webOutageRepository;
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
        Assert.notNull(m_webOutageRepository, "webOutageRepository must be set");
    }

    /**
     * <p>getDefaultOutageType</p>
     *
     * @return a {@link org.opennms.web.outage.OutageType} object.
     */
    public OutageType getDefaultOutageType() {
        return m_defaultOutageType;
    }

    /**
     * <p>setDefaultOutageType</p>
     *
     * @param defaultOutageType a {@link org.opennms.web.outage.OutageType} object.
     */
    public void setDefaultOutageType(OutageType defaultOutageType) {
        m_defaultOutageType = defaultOutageType;
    }

    /**
     * <p>getDefaultSortStyle</p>
     *
     * @return a {@link org.opennms.web.outage.SortStyle} object.
     */
    public SortStyle getDefaultSortStyle() {
        return m_defaultSortStyle;
    }

    /**
     * <p>setDefaultSortStyle</p>
     *
     * @param defaultSortStyle a {@link org.opennms.web.outage.SortStyle} object.
     */
    public void setDefaultSortStyle(SortStyle defaultSortStyle) {
        m_defaultSortStyle = defaultSortStyle;
    }

}
