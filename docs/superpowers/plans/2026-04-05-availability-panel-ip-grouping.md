# Availability Panel IP Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the availability panel's flat service card grid into sections grouped by IP interface address.

**Architecture:** The template's nested `v-for` is restructured so the outer loop iterates over `ipinterfaces` and renders an IP header label, while the inner loop renders service cards for that interface. The IP address is removed from individual cards since it is now carried by the section header.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), SCSS with Feather DS variables

---

### Task 1: Restructure template and styles

**Files:**
- Modify: `ui/src/components/NodeDetail/AvailabilityPanel.vue`

- [ ] **Step 1: Replace the cards section template**

In `AvailabilityPanel.vue`, replace the entire `<!-- Percentage cards -->` block (lines 31–45):

```html
      <!-- Percentage cards grouped by IP interface -->
      <div class="availability-panel__cards">
        <div
          v-for="iface in availability.ipinterfaces"
          :key="iface.id"
          class="availability-panel__iface-group"
        >
          <div class="availability-panel__iface-header subtitle2">{{ iface.address }}</div>
          <div class="availability-panel__iface-cards">
            <div
              v-for="svc in iface.services"
              :key="svc.id"
              class="avail-card"
              :class="severityClass(svc.availability)"
            >
              <div class="avail-card__name subtitle2">{{ svc.name }}</div>
              <div class="avail-card__pct headline3">{{ formatPct(svc.availability) }}%</div>
            </div>
          </div>
        </div>
      </div>
```

Note: the `avail-card__ip` element is intentionally removed.

- [ ] **Step 2: Update SCSS**

In the `<style>` block, make these changes:

Replace:
```scss
  &__cards   { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
```
With:
```scss
  &__cards        { margin-bottom: 12px; }
  &__iface-group  { margin-bottom: 16px; }
  &__iface-group:last-child { margin-bottom: 0; }
  &__iface-header { color: var($secondary-text-on-surface); margin-bottom: 6px; }
  &__iface-cards  { display: flex; flex-wrap: wrap; gap: 12px; }
```

And remove the `.avail-card__ip` rule:
```scss
  &__ip   { opacity: 0.7; margin-bottom: 4px; }
```

- [ ] **Step 3: Verify the build compiles**

```bash
cd ui && yarn build 2>&1 | tail -20
```

Expected: no errors, build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add ui/src/components/NodeDetail/AvailabilityPanel.vue
git commit -m "feat(availability): group service cards by IP interface"
```
