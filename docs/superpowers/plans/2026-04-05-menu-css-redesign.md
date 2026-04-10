# Menu CSS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the top bar and side menu into a contiguous branded surface using `#0081ad` (the Horizon logo blue) in light mode, eliminate the visual border between them, and lower the side menu collapse toggle slightly.

**Architecture:** CSS-only overrides in two Vue SFC files. All color changes are wrapped in `.open-light` so dark mode is unaffected. The blue is `#0081ad` — the solid brand color used for the "Horizon" wordmark text in `LogoHorizon.vue`. No JS, no new components.

**Tech Stack:** Vue 3 SFC, SCSS, Feather Design System CSS variables

---

## File Map

| File | What changes |
|------|-------------|
| `ui/src/components/Menu/SideMenu.vue` | Bump `--feather-dock-toggle-top` from `2em` to `3em`; add `.open-light` overrides for dock background + text color |
| `ui/src/components/Menu/Menubar.vue` | Add `.open-light` overrides for header background, border elimination, and white text/icon color |

---

### Task 1: Side menu — toggle nudge + blue background

**Files:**
- Modify: `ui/src/components/Menu/SideMenu.vue`

The scoped `<style>` block sets `--feather-dock-toggle-top: 2em`. Increase it to `3em`.

The unscoped `<style>` block currently has bare `#opennms-sidebar-control` rules. Add a `.open-light`-scoped block after them to override the Feather Sidenav background and text color.

- [ ] **Step 1: Update the toggle position in the scoped style block**

In `ui/src/components/Menu/SideMenu.vue`, find the scoped `<style lang="scss" scoped>` block. The relevant rule is inside `#opennms-sidemenu-vue-container > #opennms-sidebar-control`. Change:

```scss
    #opennms-sidebar-control {
      --feather-dock-header-offset: 3.75rem;
    
      // tighten spacing between toggle button and top of menu items
      --feather-dock-content-padding-top: 3em;
      --feather-dock-toggle-top: 2em;
    }
```

to:

```scss
    #opennms-sidebar-control {
      --feather-dock-header-offset: 3.75rem;
    
      // tighten spacing between toggle button and top of menu items
      --feather-dock-content-padding-top: 3em;
      --feather-dock-toggle-top: 3em;
    }
```

- [ ] **Step 2: Add light-mode blue background overrides in the unscoped style block**

In `ui/src/components/Menu/SideMenu.vue`, find the unscoped `<style lang="scss">` block (after the scoped block). Append the following rule **after** the existing `#opennms-sidebar-control { ... }` block:

```scss
.open-light {
  #opennms-sidebar-control {
    --feather-dock-background: #0081ad;
    --feather-dock-color: #fff;
  }
}
```

`--feather-dock-background` controls the dock panel fill. `--feather-dock-color` is used by Feather for icon and text foreground inside the dock (already referenced by the existing separator border rule: `var(--feather-dock-color)`). Setting both to brand blue + white gives readable contrast without touching individual item rules.

Note: flyout popovers use a separate Feather popover surface and will not inherit these variables — they remain white/light by default. No override needed.

- [ ] **Step 3: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Menu/SideMenu.vue
git commit -m "feat(menu): lower collapse toggle; brand blue side menu in light mode"
```

---

### Task 2: Top bar — blue background + border elimination

**Files:**
- Modify: `ui/src/components/Menu/Menubar.vue`

The unscoped `<style lang="scss">` block in `Menubar.vue` already contains a `.open-light { @include open-light; }` rule and the box-shadow removal rule `.header-wrapper.feather-app-bar-wrapper .header { box-shadow: none; }`.

We need to:
1. Give the header a `#0081ad` background in light mode
2. Remove any border-bottom that would create a seam at the top/side junction
3. Force header content (text, icons) to render white so they remain readable on the blue surface

- [ ] **Step 1: Add light-mode header background and border elimination**

In the unscoped `<style lang="scss">` block in `ui/src/components/Menu/Menubar.vue`, find the existing `.open-light` rule and extend it:

```scss
.open-light {
  @include open-light;

  .header-wrapper.feather-app-bar-wrapper .header {
    background-color: #0081ad;
    border-bottom: none;
  }

  .header-wrapper.feather-app-bar-wrapper .header-content {
    color: #fff;
  }
}
```

`color: #fff` on `.header-content` cascades to all child text and SVG icons (Feather icons use `currentColor` for fill). This covers the date/time display, the light/dark mode toggle icon, and the notification/self-service icon buttons in a single rule.

The existing `box-shadow: none` rule outside `.open-light` already suppresses elevation — leave it untouched:

```scss
// leave this as-is — applies in both themes
.header-wrapper.feather-app-bar-wrapper .header {
  box-shadow: none;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/chance/git/opennms
git add ui/src/components/Menu/Menubar.vue
git commit -m "feat(menu): brand blue top bar with white content in light mode"
```

---

### Task 3: Build, deploy, and verify

**Files:** none — build + verification only

- [ ] **Step 1: Build the UI**

```bash
cd /Users/chance/git/opennms/ui && /Users/chance/git/opennms/ui/target/node/yarn/dist/bin/yarn build
```

Expected: build completes with no errors. Do NOT use `npm run build`.

- [ ] **Step 2: Verify built index.html has correct asset paths**

```bash
grep -o 'src="/opennms/ui/assets/index-[^"]*\.js"' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Expected: one match like `src="/opennms/ui/assets/index-abc123.js"`

- [ ] **Step 3: Verify CSS has no bare `--feather-*` values**

```bash
grep -o '\-\-feather-[a-z\-]*[^;)"]' /Users/chance/git/opennms/ui/src/main/dist/assets/*.css | grep -v 'var(' | head -20
```

Expected: no output (all Feather vars must be wrapped in `var()`).

- [ ] **Step 4: Ensure container is running**

```bash
podman ps --filter name=test-opennms --format "{{.Status}}"
```

Expected: `Up ...`. If the container is stopped, start it:

```bash
podman start test-opennms
```

Wait ~20 seconds and confirm it's healthy:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8980/opennms/login.jsp
```

Expected: `200`

- [ ] **Step 5: Deploy to container**

```bash
cd /Users/chance/git/opennms/ui && ./deploy-to-container.sh test-opennms
```

- [ ] **Step 6: Verify live bundle hash matches built hash**

```bash
podman exec test-opennms grep -o 'assets/index-[^"]*\.js' /opt/opennms/jetty-webapps/opennms/ui/index.html
grep -o 'assets/index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html
```

Both lines must output the same hash. If they differ, the deploy did not complete correctly.

- [ ] **Step 7: Verify the JS bundle serves correctly**

```bash
curl -s -o /dev/null -w "%{http_code}" -L "http://localhost:8980/opennms/ui/assets/$(grep -o 'index-[^"]*\.js' /Users/chance/git/opennms/ui/src/main/dist/index.html)"
```

Expected: `200`

- [ ] **Step 8: Visual verification checklist**

Open `http://localhost:8980/opennms/ui/` in the browser and do a hard refresh (`Cmd+Shift+R`).

**Light mode — check all of these:**
- [ ] Top bar background is medium blue (`#0081ad`) — not white, not dark
- [ ] Side menu background is the same blue — they look like one surface
- [ ] No visible line or seam where the top bar meets the side menu
- [ ] OpenNMS Horizon logo is visible and white (it renders white fills on colored bg)
- [ ] Date/time text in top bar is white and readable
- [ ] Light/dark toggle icon in top bar is white
- [ ] Side menu icons are white
- [ ] Side menu item labels are white/light and readable
- [ ] Flyout/popover sub-menus (hover a menu item) have a **white or light background** — not blue
- [ ] Collapse toggle button is visibly lower than before

**Dark mode — verify no regressions:**
- [ ] Toggle to dark mode — top bar returns to its normal dark theme color
- [ ] Side menu returns to its normal dark theme color
- [ ] No blue bleed in dark mode

- [ ] **Step 9: Squash and clean up commits if needed**

Review the two commits:

```bash
git log --oneline -5
```

If both commits look clean and well-described, leave them. If you need to squash:

```bash
git rebase -i HEAD~2
```

Then mark the second commit as `squash` and edit the message to:

```
feat(menu): unified brand blue nav (top bar + side menu) in light mode
```
