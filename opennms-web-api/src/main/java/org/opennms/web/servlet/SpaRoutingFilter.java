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

import java.io.IOException;
import java.util.regex.Pattern;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;

@WebFilter(asyncSupported = true, urlPatterns = "/*")
public class SpaRoutingFilter implements Filter {

    public static final String UI_VERSION_PROPERTY = "org.opennms.web.ui.version";
    public static final String DEFAULT_VERSION = "default";

    private static final Pattern SAFE_VERSION = Pattern.compile("[A-Za-z0-9._-]+");

    @Override
    public void doFilter(final ServletRequest request, final ServletResponse response, final FilterChain chain) throws IOException, ServletException {
        final HttpServletRequest httpServletRequest = (HttpServletRequest) request;
        final String uri = httpServletRequest.getRequestURI().substring(httpServletRequest.getContextPath().length());

        if (!uri.equals("/ui") && !uri.startsWith("/ui/")) {
            chain.doFilter(request, response);
            return;
        }

        final String version = activeVersion();
        final String suffix = isAsset(uri) ? uri.substring("/ui".length()) : "/index.html";
        final String target = "/ui-versions/" + version + suffix;
        request.getRequestDispatcher(target).forward(request, response);
    }

    private String activeVersion() {
        final String value = System.getProperty(UI_VERSION_PROPERTY, DEFAULT_VERSION);
        if (value.contains("..") || !SAFE_VERSION.matcher(value).matches()) {
            return DEFAULT_VERSION;
        }
        return value;
    }

    private boolean isAsset(final String uri) {
        return uri.startsWith("/ui/assets/") || uri.endsWith(".svg");
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // pass
    }

    @Override
    public void destroy() {
        // pass
    }
}
