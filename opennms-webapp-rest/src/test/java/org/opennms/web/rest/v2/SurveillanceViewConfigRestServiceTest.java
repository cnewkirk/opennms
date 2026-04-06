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
package org.opennms.web.rest.v2;

import static org.junit.Assert.*;

import java.util.List;

import org.junit.Test;
import org.opennms.netmgt.config.surveillanceViews.Category;
import org.opennms.netmgt.config.surveillanceViews.ColumnDef;
import org.opennms.netmgt.config.surveillanceViews.RowDef;
import org.opennms.netmgt.config.surveillanceViews.SurveillanceViewConfiguration;
import org.opennms.netmgt.config.surveillanceViews.View;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.SurveillanceViewConfigDto;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.ViewDto;
import org.opennms.web.rest.v2.SurveillanceViewConfigRestService.RowOrColumnDto;

public class SurveillanceViewConfigRestServiceTest {

    @Test
    public void toDtoPreservesDefaultView() {
        SurveillanceViewConfiguration config = new SurveillanceViewConfiguration();
        config.setDefaultView("myview");
        View view = new View();
        view.setName("myview");
        view.setRefreshSeconds(120);
        config.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(config);

        assertEquals("myview", dto.getDefaultView());
        assertEquals(1, dto.getViews().size());
        assertEquals("myview", dto.getViews().get(0).getName());
        assertEquals(120, dto.getViews().get(0).getRefreshSeconds());
    }

    @Test
    public void toDtoMapsRowsAndColumns() {
        SurveillanceViewConfiguration config = new SurveillanceViewConfiguration();
        View view = new View();
        view.setName("default");

        RowDef row = new RowDef();
        row.setLabel("Routers");
        Category cat = new Category();
        cat.setName("Routers");
        row.addCategory(cat);
        view.addRow(row);

        ColumnDef col = new ColumnDef();
        col.setLabel("PROD");
        Category prodCat = new Category();
        prodCat.setName("Production");
        col.addCategory(prodCat);
        view.addColumn(col);

        config.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(config);

        ViewDto viewDto = dto.getViews().get(0);
        assertEquals(1, viewDto.getRows().size());
        assertEquals("Routers", viewDto.getRows().get(0).getLabel());
        assertEquals(List.of("Routers"), viewDto.getRows().get(0).getCategories());
        assertEquals(1, viewDto.getColumns().size());
        assertEquals("PROD", viewDto.getColumns().get(0).getLabel());
        assertEquals(List.of("Production"), viewDto.getColumns().get(0).getCategories());
    }

    @Test
    public void roundTripPreservesData() {
        SurveillanceViewConfiguration original = new SurveillanceViewConfiguration();
        original.setDefaultView("default");
        View view = new View();
        view.setName("default");
        view.setRefreshSeconds(300);

        RowDef row = new RowDef();
        row.setLabel("Switches");
        Category cat = new Category();
        cat.setName("Switches");
        row.addCategory(cat);
        view.addRow(row);

        ColumnDef col = new ColumnDef();
        col.setLabel("TEST");
        Category testCat = new Category();
        testCat.setName("Test");
        col.addCategory(testCat);
        view.addColumn(col);

        original.getViews().add(view);

        SurveillanceViewConfigDto dto = SurveillanceViewConfigRestService.toDto(original);
        SurveillanceViewConfiguration roundTripped = SurveillanceViewConfigRestService.fromDto(dto);

        assertEquals("default", roundTripped.getDefaultView());
        assertEquals(1, roundTripped.getViews().size());
        View rt = roundTripped.getViews().get(0);
        assertEquals("default", rt.getName());
        assertEquals(300, rt.getRefreshSeconds());
        assertEquals(1, rt.getRows().size());
        assertEquals("Switches", rt.getRows().get(0).getLabel());
        assertEquals("Switches", rt.getRows().get(0).getCategories().get(0).getName());
        assertEquals(1, rt.getColumns().size());
        assertEquals("TEST", rt.getColumns().get(0).getLabel());
    }

    @Test
    public void fromDtoHandlesEmptyViews() {
        SurveillanceViewConfigDto dto = new SurveillanceViewConfigDto();
        dto.setDefaultView("");
        dto.setViews(List.of());

        SurveillanceViewConfiguration config = SurveillanceViewConfigRestService.fromDto(dto);

        assertNotNull(config);
        assertTrue(config.getViews().isEmpty());
    }
}
