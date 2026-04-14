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

import static org.junit.Assert.assertEquals;

import org.junit.After;
import org.junit.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.ModelAndView;

public class FrontPageControllerTest {

    private final FrontPageController controller = new FrontPageController();

    @After
    public void clearProperty() {
        System.clearProperty("org.opennms.web.ui");
        System.clearProperty("org.opennms.dashboard.redirect");
    }

    @Test
    public void testNextUiRedirectsToVueSpa() throws Exception {
        System.setProperty("org.opennms.web.ui", "next");
        ModelAndView mav = controller.handleRequest(new MockHttpServletRequest(), new MockHttpServletResponse());
        assertEquals("redirect:/ui/", mav.getViewName());
    }

    @Test
    public void testNextUiIsCaseInsensitive() throws Exception {
        System.setProperty("org.opennms.web.ui", "NEXT");
        ModelAndView mav = controller.handleRequest(new MockHttpServletRequest(), new MockHttpServletResponse());
        assertEquals("redirect:/ui/", mav.getViewName());
    }

    @Test
    public void testClassicPropertyRedirectsToClassicUi() throws Exception {
        System.setProperty("org.opennms.web.ui", "classic");
        ModelAndView mav = controller.handleRequest(new MockHttpServletRequest(), new MockHttpServletResponse());
        assertEquals("redirect:/index.jsp", mav.getViewName());
    }

    @Test
    public void testDefaultWithNoPropertyRedirectsToClassicUi() throws Exception {
        // property absent — classic is default
        ModelAndView mav = controller.handleRequest(new MockHttpServletRequest(), new MockHttpServletResponse());
        assertEquals("redirect:/index.jsp", mav.getViewName());
    }

    @Test
    public void testNextUiTakesPrecedenceOverDashboardRedirect() throws Exception {
        System.setProperty("org.opennms.web.ui", "next");
        System.setProperty("org.opennms.dashboard.redirect", "true");
        ModelAndView mav = controller.handleRequest(new MockHttpServletRequest(), new MockHttpServletResponse());
        assertEquals("redirect:/ui/", mav.getViewName());
    }
}
