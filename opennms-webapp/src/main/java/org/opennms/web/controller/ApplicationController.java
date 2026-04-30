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
package org.opennms.web.controller;

import java.util.List;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.opennms.netmgt.model.OnmsApplication;
import org.opennms.web.svclayer.AdminApplicationService;
import org.opennms.web.svclayer.support.DefaultAdminApplicationService.EditModel;
import org.opennms.web.svclayer.support.DefaultAdminApplicationService.ServiceEditModel;
import org.springframework.web.servlet.ModelAndView;
import org.springframework.web.servlet.mvc.AbstractController;
import org.springframework.web.servlet.view.RedirectView;

/**
 * <p>ApplicationController class.</p>
 *
 * @author ranger
 * @version $Id: $
 * @since 1.8.1
 */
public class ApplicationController extends AbstractController {

    private AdminApplicationService m_adminApplicationService;

    private String getNonEmptyParameter(HttpServletRequest request, String parameter) {
    	if (request != null) {
    		String p = request.getParameter(parameter);
    		if (p != null && !p.equals("")) {
    			return p;
    		}
    	}
    	return null;
    }
    
    /** {@inheritDoc} */
    @Override
    protected ModelAndView handleRequestInternal(HttpServletRequest request, HttpServletResponse response) throws Exception {
        return new ModelAndView(new RedirectView(request.getContextPath() + "/ui/applications", false));
    }

    /**
     * <p>getAdminApplicationService</p>
     *
     * @return a {@link org.opennms.web.svclayer.AdminApplicationService} object.
     */
    public AdminApplicationService getAdminApplicationService() {
        return m_adminApplicationService;
    }

    /**
     * <p>setAdminApplicationService</p>
     *
     * @param adminApplicationService a {@link org.opennms.web.svclayer.AdminApplicationService} object.
     */
    public void setAdminApplicationService(
            AdminApplicationService adminApplicationService) {
        m_adminApplicationService = adminApplicationService;
    }

}
