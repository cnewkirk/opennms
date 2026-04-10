# Menu CSS Redesign — Design Spec

**Date:** 2026-04-05  
**Branch:** feature/jmx-config-vue  
**Scope:** CSS-only changes to top bar (`Menubar.vue`) and side menu (`SideMenu.vue`)

---

## Goal

Unify the top navigation bar and side menu into a single contiguous branded surface using the OpenNMS Horizon logo blue. Changes are light-mode only; dark mode is untouched.

---

## Changes

### 1. Brand blue background — top bar (`Menubar.vue`)

- Override the `FeatherAppBar` background to `#0081ad` (the solid brand blue from the Horizon logo, used for the "Horizon" wordmark text in the SVG).
- Scoped to `.open-light` so dark mode is not affected.
- Override must use `:deep(.header)` or equivalent since `FeatherAppBar` renders into a shadow-like scoped slot structure.
- Set `color: #fff` on the top bar content (date/time display, icons) so text remains readable on the colored background.

### 2. Brand blue background — side menu (`SideMenu.vue`)

- Override `--feather-dock-background` to `#0081ad` inside `.open-light`.
- Override `--feather-dock-color` to `#fff` so icons and menu item labels remain readable.
- Flyout/popover sub-menus (`.popover`) must **not** inherit the blue — they should retain their default white/light background. These are already scoped separately via the popover container and require no additional override.

### 3. Border elimination between top bar and side menu

- Setting both surfaces to the same `#0081ad` visually eliminates the seam for free.
- Add `border-bottom: none` to `.header` within `.open-light` scope to prevent any residual `FeatherAppBar` border from rendering as a thin line at the junction.

### 4. Collapse toggle button nudge

- The side menu's expand/collapse toggle is currently positioned at `--feather-dock-toggle-top: 2em`.
- Increase to `3em` to push it slightly lower, improving visual separation from the very top of the nav rail.
- This variable is already set in `SideMenu.vue`'s scoped styles and has no light/dark dependency.

---

## Files Changed

| File | Change |
|------|--------|
| `ui/src/components/Menu/Menubar.vue` | Add `.open-light` scoped background + color overrides; add `border-bottom: none` |
| `ui/src/components/Menu/SideMenu.vue` | Override `--feather-dock-background`, `--feather-dock-color` under `.open-light`; bump toggle top |

---

## Logo Reference

Logo in use: `LogoHorizon.vue` (set via `VITE_APP_LOGO_NAME=LogoHorizon` in `.env`)

Brand colors extracted from the SVG:
- `#0081ad` — solid blue, used for the "Horizon" text and as `cls-8` fill
- `#14d1df` — lighter teal, the bright end of the logo mark gradient
- `#85d9a5` — mint green, the warm end of the secondary gradient

The logo's primary text uses `fill: #fff`, confirming it was designed to render on a colored background. Using `#0081ad` as the nav background will cause the logo to appear intentional and on-brand.

---

## Non-Goals

- No changes to dark mode styles.
- No changes to popover/flyout menu colors.
- No JS or logic changes.
- No changes to any other pages or components outside the two menu files.
