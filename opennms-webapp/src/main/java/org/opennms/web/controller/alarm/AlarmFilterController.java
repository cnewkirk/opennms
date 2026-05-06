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
package org.opennms.web.controller.alarm;

import org.opennms.netmgt.model.OnmsFilterFavorite;
import org.opennms.web.filter.FilterUtil;
import org.opennms.web.services.FilterFavoriteService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.multiaction.MultiActionController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * A controller that handles querying the event table by using filters to create an
 * event list and and then forwards that event list to a JSP for display.
 *
 * @author <A HREF="mailto:larry@opennms.org">Lawrence Karnowski </A>
 * @author <A HREF="http://www.opennms.org/">OpenNMS </A>
 */
public class AlarmFilterController extends MultiActionController implements InitializingBean {

    private static final Logger LOG = LoggerFactory.getLogger(AlarmFilterController.class);

    @Autowired
    private FilterFavoriteService favoriteService;

    @Override
    @Transactional
    public ModelAndView handleRequest(HttpServletRequest request, HttpServletResponse response) throws Exception {
        return super.handleRequest(request, response);
    }

    public ModelAndView list(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/alarms");
        return null;
    }

    // index view
    public ModelAndView index(HttpServletRequest request, HttpServletResponse response) throws Exception {
        response.sendRedirect(request.getContextPath() + "/ui/alarms");
        return null;
    }

    public ModelAndView createFavorite(HttpServletRequest request, HttpServletResponse response) throws Exception {
        try {
            favoriteService.createFavorite(
                    request.getRemoteUser(),
                    request.getParameter("favoriteName"),
                    FilterUtil.toFilterURL(request.getParameterValues("filter")),
                    OnmsFilterFavorite.Page.ALARM);
        } catch (FilterFavoriteService.FilterFavoriteException ex) {
            LOG.warn("Failed to create alarm filter favorite: {}", ex.getMessage());
        }
        response.sendRedirect(request.getContextPath() + "/ui/alarms");
        return null;
    }

    public ModelAndView deleteFavorite(HttpServletRequest request, HttpServletResponse response) throws Exception {
        favoriteService.deleteFavorite(request.getParameter("favoriteId"), request.getRemoteUser());
        response.sendRedirect(request.getContextPath() + "/ui/alarms");
        return null;
    }

    @Override
    public void afterPropertiesSet() {
        // no-op: favoriteService is @Autowired; Spring will fail injection if it's missing
    }

    public void setFavoriteService(FilterFavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }
}
