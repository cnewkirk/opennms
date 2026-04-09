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
package org.opennms.netmgt.model;

import java.io.Serializable;
import java.util.Date;
import java.util.Objects;
import java.util.UUID;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Temporal;
import javax.persistence.TemporalType;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;

import com.google.common.base.MoreObjects;

/**
 * JPA entity for a saved topology view.
 *
 * <p>scope valid values: "global", "shared", "private"
 * <p>'system' is a reserved owner sentinel for global default views — do not resolve as user
 */
@Entity
@Table(name = "topology_views")
@XmlRootElement(name = "view")
@XmlAccessorType(XmlAccessType.NONE)
public class TopologyView implements Serializable {

    private static final long serialVersionUID = 1L;

    public TopologyView() {
    }

    @Id
    @Column(name = "id", length = 64, nullable = false)
    @XmlElement(name = "id")
    private String id;

    @Column(name = "name", length = 255, nullable = false)
    @XmlElement(name = "name")
    private String name;

    @Column(name = "description", length = 1024)
    @XmlElement(name = "description")
    private String description;

    // Valid values: "global", "shared", "private"
    @Column(name = "scope", length = 16, nullable = false)
    @XmlElement(name = "scope")
    private String scope;

    // 'system' is a reserved owner sentinel for global default views — do not resolve as user
    @Column(name = "owner", length = 255, nullable = false)
    @XmlElement(name = "owner")
    private String owner;

    @Column(name = "state_json", nullable = false, columnDefinition = "text")
    @XmlElement(name = "stateJson")
    private String stateJson;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    @XmlElement(name = "createdAt")
    private Date createdAt;

    @Column(name = "updated_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    @XmlElement(name = "updatedAt")
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) id = UUID.randomUUID().toString();
        final Date now = new Date();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }

    public String getId() {
        return id;
    }

    public void setId(final String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(final String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(final String description) {
        this.description = description;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(final String scope) {
        this.scope = scope;
    }

    public String getOwner() {
        return owner;
    }

    public void setOwner(final String owner) {
        this.owner = owner;
    }

    public String getStateJson() {
        return stateJson;
    }

    public void setStateJson(final String stateJson) {
        this.stateJson = stateJson;
    }

    public Date getCreatedAt() {
        return createdAt == null ? null : new Date(createdAt.getTime());
    }

    public void setCreatedAt(final Date createdAt) {
        this.createdAt = createdAt == null ? null : new Date(createdAt.getTime());
    }

    public Date getUpdatedAt() {
        return updatedAt == null ? null : new Date(updatedAt.getTime());
    }

    public void setUpdatedAt(final Date updatedAt) {
        this.updatedAt = updatedAt == null ? null : new Date(updatedAt.getTime());
    }

    @Override
    public boolean equals(final Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof TopologyView)) return false;
        final TopologyView other = (TopologyView) obj;
        return Objects.equals(id, other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .add("name", name)
                .add("scope", scope)
                .add("owner", owner)
                .toString();
    }
}
