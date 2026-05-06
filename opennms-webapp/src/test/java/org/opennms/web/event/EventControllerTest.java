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
package org.opennms.web.event;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.opennms.netmgt.dao.api.AlarmRepository;
import org.opennms.netmgt.dao.hibernate.AlarmRepositoryHibernate;
import org.opennms.web.controller.alarm.AlarmFilterController;
import org.opennms.web.controller.event.EventController;
import org.opennms.web.event.DaoWebEventRepository;
import org.opennms.web.event.WebEventRepository;
import org.opennms.web.services.FilterFavoriteService;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.servlet.ModelAndView;

import static org.mockito.Mockito.mock;


public class EventControllerTest  {

    /** The controller. */
    private EventController eventController;

    private WebEventRepository m_webEventRepository;

    private FilterFavoriteService favoriteService;

    private AlarmFilterController alarmFilterController;

    private AlarmRepository m_webAlarmRepository;


    @Before
    public void setUp() {
        //Event controller/filter settings
        m_webEventRepository = mock(DaoWebEventRepository.class);
        favoriteService = mock(FilterFavoriteService.class);
        eventController = new EventController();
        eventController.setWebEventRepository(m_webEventRepository);
        eventController.setFavoriteService(favoriteService);
        eventController.setServletContext(new MockServletContext("file:src/main/webapp"));
        eventController.afterPropertiesSet();

        //Alarm controller/filter settings
        m_webAlarmRepository = mock(AlarmRepositoryHibernate.class);
        alarmFilterController = new AlarmFilterController();
        alarmFilterController.setServletContext(new MockServletContext("file:src/main/webapp"));
        alarmFilterController.setWebAlarmRepository(m_webAlarmRepository);
        alarmFilterController.setFavoriteService(favoriteService);
        alarmFilterController.afterPropertiesSet();
    }

    /**
     * Test that list() redirects to Vue events page.
     *
     * @throws Exception the exception
     */
    @Test
    public void testListRedirectsToVueEvents() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("/opennms");

        ModelAndView mv = eventController.list(request, response);

        Assert.assertNull(mv);
        Assert.assertEquals("/opennms/ui/events", response.getRedirectedUrl());
    }

    /**
     * Test that list() redirects to Vue alarms page.
     *
     * @throws Exception the exception
     */
    @Test
    public void testAlarmListRedirectsToVueAlarms() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("/opennms");

        ModelAndView mv = alarmFilterController.list(request, response);

        Assert.assertNull(mv);
        Assert.assertEquals("/opennms/ui/alarms", response.getRedirectedUrl());
    }
}
