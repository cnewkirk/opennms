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
package org.opennms.web.servlet;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.After;
import org.junit.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

public class SpaRoutingFilterTest {

    private static final String PROP = "org.opennms.web.ui.version";

    @After
    public void clearProperty() {
        System.clearProperty(PROP);
    }

    private MockHttpServletResponse runFilter(String uri, MockFilterChain chain) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        new SpaRoutingFilter().doFilter(req, res, chain);
        return res;
    }

    @Test
    public void defaultVersion_spaDeepLink_forwardsToDefaultIndex() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse res = runFilter("/ui/dashboard", chain);
        assertEquals("/ui-versions/default/index.html", res.getForwardedUrl());
        assertNull("filter chain should not be invoked when forwarding", chain.getRequest());
    }

    @Test
    public void namedVersion_spaDeepLink_forwardsToActiveVersionIndex() throws Exception {
        System.setProperty(PROP, "next");
        MockHttpServletResponse res = runFilter("/ui/dashboard", new MockFilterChain());
        assertEquals("/ui-versions/next/index.html", res.getForwardedUrl());
    }

    @Test
    public void namedVersion_assetRequest_forwardsToActiveVersionAsset() throws Exception {
        System.setProperty(PROP, "next");
        MockHttpServletResponse res = runFilter("/ui/assets/index-abc123.js", new MockFilterChain());
        assertEquals("/ui-versions/next/assets/index-abc123.js", res.getForwardedUrl());
    }

    @Test
    public void namedVersion_svgAsset_forwardsToActiveVersionSvg() throws Exception {
        System.setProperty(PROP, "next");
        MockHttpServletResponse res = runFilter("/ui/logo.svg", new MockFilterChain());
        assertEquals("/ui-versions/next/logo.svg", res.getForwardedUrl());
    }

    @Test
    public void dottedVersionName_isAccepted() throws Exception {
        System.setProperty(PROP, "35.1.0-beta");
        MockHttpServletResponse res = runFilter("/ui/dashboard", new MockFilterChain());
        assertEquals("/ui-versions/35.1.0-beta/index.html", res.getForwardedUrl());
    }

    @Test
    public void slashInVersionName_fallsBackToDefault() throws Exception {
        System.setProperty(PROP, "../etc/passwd");
        MockHttpServletResponse res = runFilter("/ui/dashboard", new MockFilterChain());
        assertEquals("/ui-versions/default/index.html", res.getForwardedUrl());
    }

    @Test
    public void dotDotInVersionName_fallsBackToDefault() throws Exception {
        System.setProperty(PROP, "..");
        MockHttpServletResponse res = runFilter("/ui/dashboard", new MockFilterChain());
        assertEquals("/ui-versions/default/index.html", res.getForwardedUrl());
    }

    @Test
    public void nonUiRequest_passesThroughChainUnchanged() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/some/other/path");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        new SpaRoutingFilter().doFilter(req, res, chain);
        assertNull("non-/ui request must not be forwarded", res.getForwardedUrl());
        assertNotNull("non-/ui request must be passed through the chain", chain.getRequest());
    }
}
