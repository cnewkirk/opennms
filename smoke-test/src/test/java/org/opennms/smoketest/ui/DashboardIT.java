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
package org.opennms.smoketest.ui;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Before;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.opennms.smoketest.OpenNMSSeleniumIT;

/**
 * Smoke tests for the Vue dashboard page with gridstack drag+resize widgets.
 */
public class DashboardIT extends OpenNMSSeleniumIT {

    @Before
    public void setUp() {
        getDriver().get(getBaseUrlInternal() + "opennms/ui/dashboard");
        wait.until(pageContainsText("Dashboard"));
    }

    /**
     * The four default widgets render and the gridstack container is present.
     */
    @Test
    public void defaultWidgetsRender() {
        // gridstack container must be present — confirms gridstack initialized
        WebElement grid = findElementByXpath("//div[contains(@class,'grid-stack')]");
        assertNotNull("gridstack container not found", grid);
        assertTrue("gridstack container not visible", grid.isDisplayed());

        // all four default widget frames must be present
        List<WebElement> frames = getDriver().findElements(By.xpath("//div[contains(@class,'widget-frame')]"));
        assertEquals("Expected 4 default widget frames", 4, frames.size());

        // each widget frame has a drag handle — confirms Task 5 landed
        List<WebElement> handles = getDriver().findElements(By.xpath("//div[contains(@class,'widget-drag-handle')]"));
        assertEquals("Expected 4 drag handles (one per widget)", 4, handles.size());

        // spot-check specific widget titles
        wait.until(pageContainsText("Network Summary"));
        wait.until(pageContainsText("Active Outages"));
        wait.until(pageContainsText("Active Alarms"));
        wait.until(pageContainsText("Nodes"));
    }

    /**
     * Clicking "Add Widget" → "Active Alarms" adds a fifth widget frame.
     */
    @Test
    public void addWidgetIncreasesCount() {
        // open the add-widget dropdown
        WebElement addBtn = findElementByXpath("//button[.//span[contains(text(),'Add Widget')] or contains(text(),'Add Widget')]");
        addBtn.click();

        // click the Alarms option
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//button[contains(@class,'add-widget-item') and contains(text(),'Active Alarms')]")));
        findElementByXpath("//button[contains(@class,'add-widget-item') and contains(text(),'Active Alarms')]").click();

        // widget count must increase to 5
        wait.until(ExpectedConditions.numberOfElementsToBeMoreThan(
            By.xpath("//div[contains(@class,'widget-frame')]"), 4));
        List<WebElement> frames = getDriver().findElements(By.xpath("//div[contains(@class,'widget-frame')]"));
        assertEquals("Expected 5 widget frames after add", 5, frames.size());
    }

    /**
     * Clicking the remove button on a widget decreases the widget count.
     */
    @Test
    public void removeWidgetDecreasesCount() {
        // click the remove button on the first widget
        WebElement removeBtn = findElementByXpath(
            "(//div[contains(@class,'widget-frame')]//button[@title='Remove widget'])[1]");
        removeBtn.click();

        // widget count must drop to 3
        wait.until(ExpectedConditions.numberOfElementsToBe(
            By.xpath("//div[contains(@class,'widget-frame')]"), 3));
        List<WebElement> frames = getDriver().findElements(By.xpath("//div[contains(@class,'widget-frame')]"));
        assertEquals("Expected 3 widget frames after remove", 3, frames.size());
    }

    /**
     * Clicking Reset restores the four default widgets.
     */
    @Test
    public void resetRestoresDefaultLayout() {
        // remove a widget first so reset has something to restore
        findElementByXpath(
            "(//div[contains(@class,'widget-frame')]//button[@title='Remove widget'])[1]").click();
        wait.until(ExpectedConditions.numberOfElementsToBe(
            By.xpath("//div[contains(@class,'widget-frame')]"), 3));

        // click Reset
        WebElement resetBtn = findElementByXpath("//button[contains(text(),'Reset')]");
        resetBtn.click();

        // should be back to 4
        wait.until(ExpectedConditions.numberOfElementsToBe(
            By.xpath("//div[contains(@class,'widget-frame')]"), 4));
        List<WebElement> frames = getDriver().findElements(By.xpath("//div[contains(@class,'widget-frame')]"));
        assertEquals("Expected 4 widget frames after reset", 4, frames.size());

        // default titles restored
        wait.until(pageContainsText("Network Summary"));
        wait.until(pageContainsText("Active Outages"));
    }

    /**
     * Each gridstack item has the gs-* attributes set — confirms widgets are
     * position-aware and gridstack can read their initial layout.
     */
    @Test
    public void gridstackItemsHaveLayoutAttributes() {
        List<WebElement> items = getDriver().findElements(
            By.xpath("//div[contains(@class,'grid-stack-item')][@gs-w and @gs-h]"));
        assertEquals("Expected 4 grid-stack items with layout attributes", 4, items.size());

        // the full-width summary widget should span 12 columns
        WebElement summaryItem = findElementByXpath(
            "//div[contains(@class,'grid-stack-item')][@gs-w='12'][.//span[contains(text(),'Network Summary')]]");
        assertNotNull("Summary widget must have gs-w=12", summaryItem);
    }
}
