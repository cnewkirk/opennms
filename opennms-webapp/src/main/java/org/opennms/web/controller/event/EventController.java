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
package org.opennms.web.controller.event;

import org.opennms.core.utils.WebSecurityUtils;
import org.opennms.netmgt.model.OnmsFilterFavorite;
import org.opennms.web.event.*;
import org.opennms.web.event.filter.EventCriteria;
import org.opennms.web.event.filter.EventIdListFilter;
import org.opennms.web.filter.Filter;
import org.opennms.web.filter.FilterUtil;
import org.opennms.web.services.FilterFavoriteService;
import org.opennms.web.servlet.MissingParameterException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.multiaction.MultiActionController;
import org.springframework.web.servlet.view.RedirectView;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * A controller that handles all event actions (e.g. querying the event table by using filters to create an
 * event list and and then forwards that event list to a JSP for display).
 *
 * @author <A HREF="mailto:larry@opennms.org">Lawrence Karnowski</A>
 * @author <A HREF="http://www.opennms.org/">OpenNMS</A>
 * @author <A HREF="mailto:larry@opennms.org">Lawrence Karnowski</A>
 * @author <A HREF="http://www.opennms.org/">OpenNMS</A>
 * @version $Id: $
 * @since 1.8.1
 */
public class EventController extends MultiActionController implements InitializingBean {

    private static final Logger LOG = LoggerFactory.getLogger(EventController.class);

	@Autowired
    private FilterFavoriteService favoriteService;

	@Autowired
	private WebEventRepository m_webEventRepository;

    @Override
    @Transactional
    public ModelAndView handleRequest(HttpServletRequest request, HttpServletResponse response) throws Exception {
        return super.handleRequest(request, response);
    }

    /**
     * {@inheritDoc}
     *
     * Parses the query string to determine what types of event filters to use
     * (for example, what to filter on or sort by), then does the database query
     * and then forwards the results to a JSP for display.
     *
     * <p>
     * Sets the <em>events</em> and <em>parms</em> request attributes for
     * the forwardee JSP (or whatever gets called).
     * </p>
     */
    public ModelAndView list(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/events");
        return null;
    }

    public ModelAndView detail(HttpServletRequest request, HttpServletResponse response) throws Exception {
        String idString = request.getParameter("id");
        try {
            long eventId = WebSecurityUtils.safeParseLong(idString);
            response.sendRedirect(request.getContextPath() + "/ui/event/" + eventId);
            return null;
        } catch (NumberFormatException e) {
            throw new EventIdNotFoundException("Could not parse event ID '" + idString + "' to integer.", idString);
        }
    }

    // index view
    public ModelAndView index(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/events");
        return null;
    }

    public ModelAndView createFavorite(HttpServletRequest request, HttpServletResponse response) throws Exception {
        try {
            favoriteService.createFavorite(
                    request.getRemoteUser(),
                    request.getParameter("favoriteName"),
                    FilterUtil.toFilterURL(request.getParameterValues("filter")),
                    OnmsFilterFavorite.Page.EVENT);
        } catch (FilterFavoriteService.FilterFavoriteException ex) {
            LOG.warn("Failed to create event filter favorite: {}", ex.getMessage());
        }
        response.sendRedirect(request.getContextPath() + "/ui/events");
        return null;
    }

    public ModelAndView deleteFavorite(HttpServletRequest request, HttpServletResponse response) throws Exception {
        favoriteService.deleteFavorite(request.getParameter("favoriteId"), request.getRemoteUser());
        response.sendRedirect(request.getContextPath() + "/ui/events");
        return null;
    }

    /**
     * Acknowledge the events specified in the POST and then redirect the client
     * to an appropriate URL for display.
     */
    public ModelAndView acknowledge(HttpServletRequest request, HttpServletResponse response) throws Exception {

        // required parameter
        String[] eventIdStrings = request.getParameterValues("event");
        String action = request.getParameter("actionCode");

        if (eventIdStrings == null) {
            throw new MissingParameterException("event", new String[] { "event", "actionCode" });
        }

        if (action == null) {
            throw new MissingParameterException("actionCode", new String[] { "event", "actionCode" });
        }

        List<Filter> filters = new ArrayList<>();
        filters.add(new EventIdListFilter(WebSecurityUtils.safeParseLong(eventIdStrings)));
        EventCriteria criteria = new EventCriteria(filters.toArray(new Filter[0]));

        LOG.debug("criteria = {}, action = {}", criteria, action);
        if (action.equals(AcknowledgeType.ACKNOWLEDGED.getShortName())) {
            m_webEventRepository.acknowledgeMatchingEvents(request.getRemoteUser(), new Date(), criteria);
        } else if (action.equals(AcknowledgeType.UNACKNOWLEDGED.getShortName())) {
            m_webEventRepository.unacknowledgeMatchingEvents(criteria);
        } else {
            throw new ServletException("Unknown acknowledge action: " + action);
        }

        return getRedirectView(request);
    }

    /**
     * Acknowledge the events specified in the POST and then redirect the client
     * to an appropriate URL for display.
     */
    public ModelAndView acknowledgeByFilter(HttpServletRequest request, HttpServletResponse response) throws Exception {
        // required parameter
        String[] filterStrings = request.getParameterValues("filter");
        String action = request.getParameter("actionCode");

        if (filterStrings == null) {
            filterStrings = new String[0];
        }

        if (action == null) {
            throw new MissingParameterException("actionCode", new String[] { "filter", "actionCode" });
        }

        // handle the filter parameters
        ArrayList<Filter> filterArray = new ArrayList<>();
        for (String filterString : filterStrings) {
            Filter filter = EventUtil.getFilter(filterString, getServletContext());
            if (filter != null) {
                filterArray.add(filter);
            }
        }

        Filter[] filters = filterArray.toArray(new Filter[filterArray.size()]);

        EventCriteria criteria = new EventCriteria(filters);

        if (action.equals(AcknowledgeType.ACKNOWLEDGED.getShortName())) {
            m_webEventRepository.acknowledgeMatchingEvents(request.getRemoteUser(), new Date(), criteria);
        } else if (action.equals(AcknowledgeType.UNACKNOWLEDGED.getShortName())) {
            m_webEventRepository.unacknowledgeMatchingEvents(criteria);
        } else {
            throw new ServletException("Unknown acknowledge action: " + action);
        }
        return getRedirectView(request);
    }

    private ModelAndView getRedirectView(HttpServletRequest request) {
        String redirect = request.getParameter("redirect");
        String viewName;
        if (redirect != null) {
            viewName = redirect;
        } else {
            viewName = request.getContextPath() + "/ui/events";
        }
        RedirectView redirectView = new RedirectView(viewName);
        return new ModelAndView(redirectView);
    }

    @Override
    public void afterPropertiesSet() {
        Assert.notNull(m_webEventRepository, "webEventRepository must be set");
        Assert.notNull(favoriteService, "favoriteService must be set");
    }

    public void setWebEventRepository(WebEventRepository webEventRepository) {
        this.m_webEventRepository = webEventRepository;
    }

    public void setFavoriteService(FilterFavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }
}
