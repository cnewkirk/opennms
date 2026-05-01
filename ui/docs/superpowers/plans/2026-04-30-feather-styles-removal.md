# PrimeVue Phase 2 — Remove @featherds/styles SCSS Dependency

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every `@import` / `@use` of `@featherds/styles` from `ui/src/` so the SCSS build has no compile-time Feather dependency, and remove `@featherds/styles` from direct package deps.

**Architecture:** Create four local replacement SCSS files in `ui/src/styles/` (tokens, typography, elevation, utils). Each replacement file re-exports the same SCSS names as the Feather originals so call sites keep using `var($surface)` unchanged — only the `@import` path changes. Then `sed`-replace all ~360 Feather import lines across 210+ source files in batches. Build and verify after each batch. `@featherds/styles` will remain as a *transitive* dependency of `@featherds/megamenu` (still used) but will no longer be in our direct deps or imported in our source.

**Tech Stack:** SCSS/Sass, Vite, pnpm, Vue 3 SPA at `ui/src/`

**Important context:**
- All commands run from `/Users/chance/git/opennms/ui` (the pnpm project root).
- Build command: `pnpm build`
- The three `import '@featherds/styles*'` lines in `src/main/main.ts` load CSS custom properties at runtime — they **stay** in main.ts for now. Only SCSS `@import`/`@use` in `.vue`/`.scss` files are removed.
- `@featherds/megamenu` is intentionally kept (used by `ShimFeatherMegaMenu`). It depends on `@featherds/styles` transitively, so styles will remain in `node_modules` — just not in our source code or package.json directly.
- The `~@featherds` alias in `vite.config.ts` is only needed by SCSS `@import '~@featherds/...'` patterns. Once all SCSS imports are gone, the alias can be removed.

---

## Token Reference (for writing replacement files)

These are the SCSS variable names used in src/ and their CSS custom property equivalents.

### Theme tokens (from `@featherds/styles/themes/variables`)

| SCSS variable | CSS custom property | Usage count |
|---|---|---|
| `$secondary-text-on-surface` | `--feather-secondary-text-on-surface` | 248 |
| `$border-on-surface` | `--feather-border-on-surface` | 141 |
| `$primary-text-on-surface` | `--feather-primary-text-on-surface` | 125 |
| `$surface` | `--feather-surface` | 113 |
| `$primary` | `--feather-primary` | 97 |
| `$error` | `--feather-error` | 69 |
| `$border-light-on-surface` | `--feather-border-light-on-surface` | 68 |
| `$shade-4` | `--feather-shade-4` | 63 |
| `$primary-text-on-color` | `--feather-primary-text-on-color` | 38 |
| `$clickable-normal` | `--feather-clickable-normal` | 26 |
| `$success` | `--feather-success` | 24 |
| `$surface-dark` | `--feather-surface-dark` | 22 |
| `$background` | `--feather-background` | 21 |
| `$shade-3` | `--feather-shade-3` | 18 |
| `$warning` | `--feather-warning` | 10 |
| `$secondary-variant` | `--feather-secondary-variant` | 7 |
| `$major` | `--feather-major` | 6 |
| `$minor` | `--feather-minor` | 6 |
| `$shade-2` | `--feather-shade-2` | 4 |
| `$disabled-text-on-surface` | `--feather-disabled-text-on-surface` | 3 |
| `$cleared` | `--feather-cleared` | 3 |
| `$spacing-xxs` | `--feather-spacing-xxs` | 2 |
| `$border-radius-surface` | `--feather-border-radius-surface` | 2 |
| `$zindex-sticky` | `--feather-zindex-sticky` | 1 |
| `$zindex-dropdown` | `--feather-zindex-dropdown` | 1 |
| `$spacing-xl` | `--feather-spacing-xl` | 1 |
| `$spacing-m` | `--feather-spacing-m` | 1 |
| `$shade-1` | `--feather-shade-1` | 1 |
| `$secondary` | `--feather-secondary` | 1 |
| `$primary-variant` | `--feather-primary-variant` | 1 |
| `$indeterminate` | `--feather-indeterminate` | 1 |
| `$font-family` | `--feather-font-family` | 1 |

The `prefix()` function in Feather just prepends `--feather-`, so `$surface` = `--feather-surface`. Our local `_tokens.scss` will do the same thing with a plain SCSS function.

### Typography tokens (from `@featherds/styles/mixins/typography`)

Mixins used in src: `headline1`, `headline2`, `headline3`, `headline4`, `subtitle1`, `subtitle2`, `body-large`, `body-small`, `caption`, `overline`, `console`, `button`

Each mixin sets: `font-family`, `font-size`, `line-height`, `letter-spacing`, `font-weight` (all via `--feather-*` CSS vars).

### Elevation token (from `@featherds/styles/mixins/elevation`)

`elevation(N)` sets `box-shadow: var(--feather-shadow-N)` and `background-color: var(--feather-elevation-background-N)`.
Used with N=1, N=2, N=4 in src/.

### Utils (from `@featherds/styles/themes/utils`)

Only `alpha($color, $alpha)` is used. It reads the `-r`, `-g`, `-b` CSS variable companions:
```scss
@function alpha($color, $alpha) {
  $r: var(#{$color + "-r"});
  $g: var(#{$color + "-g"});
  $b: var(#{$color + "-b"});
  @return rgba($r, $g, $b, $alpha);
}
```

---

## File Map

**Create:**
- `ui/src/styles/_tokens.scss` — SCSS variable shim (replaces `@featherds/styles/themes/variables`)
- `ui/src/styles/_typography.scss` — typography mixins (replaces `@featherds/styles/mixins/typography`)
- `ui/src/styles/_elevation.scss` — elevation mixin (replaces `@featherds/styles/mixins/elevation`)
- `ui/src/styles/_utils.scss` — alpha() function (replaces `@featherds/styles/themes/utils`)

**Modify (batch sed):**
- 184 files with `@import "@featherds/styles/themes/variables"` → `@import "@/styles/tokens"`
- 10 files with `@use '@featherds/styles/themes/variables'` (various forms)
- 75 files with `@import "@featherds/styles/mixins/typography"` (various forms)
- 17 files with `@use "@featherds/styles/mixins/typography"` (various forms)
- 34 files with `@import/@use "@featherds/styles/mixins/elevation"` (various forms)
- 11 files with `@use '@featherds/styles/themes/utils'`

**Modify (manual):**
- `ui/src/styles/_severities.scss` — update its `@use` imports
- `ui/src/styles/opennms-feather-styles.scss` — update its `@use` imports
- `ui/vite.config.ts` — remove the `~@featherds` alias after imports are gone

**Remove from package.json:**
- `@featherds/styles`

---

## Tasks

### Task 1: Create `_tokens.scss`

**Files:**
- Create: `ui/src/styles/_tokens.scss`

This file re-declares every Feather SCSS variable name as a local SCSS variable pointing at the same `--feather-*` CSS custom property. It uses a `prefix()` function identical to Feather's. Files that `@import "@/styles/tokens"` can keep using `var($surface)` etc. without any other changes.

- [ ] **Step 1: Create the file**

```scss
// ui/src/styles/_tokens.scss
//
// Local replacement for @featherds/styles/themes/variables.
// Declares the same SCSS variable names so call sites using var($surface) etc.
// need only change their @import path, not their code.
//
// The --feather-* CSS custom property values are provided at runtime by:
//   main.ts → import '@featherds/styles/themes/open-light.css'
//   main.ts → import '@featherds/styles/themes/open-dark.css'
// overridden in opennms-feather-styles.scss for our zinc/blue-gray palette.

@use "sass:string";

@function prefix($name) {
  @return string.unquote("--feather-#{$name}");
}

// Surface / background
$background:   prefix(background);
$surface:      prefix(surface);
$surface-dark: prefix(surface-dark);

// Text
$primary-text-on-surface:   prefix(primary-text-on-surface);
$secondary-text-on-surface: prefix(secondary-text-on-surface);
$disabled-text-on-surface:  prefix(disabled-text-on-surface);
$primary-text-on-color:     prefix(primary-text-on-color);

// Borders
$border-on-surface:       prefix(border-on-surface);
$border-light-on-surface: prefix(border-light-on-surface);

// Brand / semantic colours
$primary:          prefix(primary);
$primary-variant:  prefix(primary-variant);
$secondary:        prefix(secondary);
$secondary-variant: prefix(secondary-variant);
$error:            prefix(error);
$success:          prefix(success);
$warning:          prefix(warning);
$major:            prefix(major);
$minor:            prefix(minor);
$indeterminate:    prefix(indeterminate);
$cleared:          prefix(cleared);

// Interaction
$clickable-normal:   prefix(clickable-normal);
$clickable-selected: prefix(clickable-selected);
$clickable-visited:  prefix(clickable-visited);

// Shades
$shade-1: prefix(shade-1);
$shade-2: prefix(shade-2);
$shade-3: prefix(shade-3);
$shade-4: prefix(shade-4);

// Typography
$font-family: prefix(font-family);

// Spacing
$spacing-xxs: prefix(spacing-xxs);
$spacing-xs:  prefix(spacing-xs);
$spacing-s:   prefix(spacing-s);
$spacing-m:   prefix(spacing-m);
$spacing-l:   prefix(spacing-l);
$spacing-xl:  prefix(spacing-xl);
$spacing-xxl: prefix(spacing-xxl);

// z-index
$zindex-dropdown: prefix(zindex-dropdown);
$zindex-sticky:   prefix(zindex-sticky);

// Border radius (kept for backward compat; vars.scss is preferred for new code)
$border-radius-surface: prefix(border-radius-surface);
```

- [ ] **Step 2: Build to confirm no errors**

```bash
pnpm build
```

Expected: `✓ built in` — no errors. (The file isn't imported anywhere yet; this just confirms it's valid SCSS.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/_tokens.scss
git commit -m "feat(styles): add local _tokens.scss to replace @featherds/styles/themes/variables"
```

---

### Task 2: Create `_typography.scss`

**Files:**
- Create: `ui/src/styles/_typography.scss`

Replicates every Feather typography mixin used in src/. Uses the same `--feather-*` CSS vars. Both `@import` and `@use ... as typo` call styles are covered because the mixin names are identical.

- [ ] **Step 1: Create the file**

```scss
// ui/src/styles/_typography.scss
//
// Local replacement for @featherds/styles/mixins/typography.
// Declares the same mixin names so call sites need only change the @import path.
// Font metric values come from --feather-* CSS custom properties loaded at runtime.

@mixin headline1 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-headline1-font-size);
  line-height: var(--feather-headline1-line-height);
  letter-spacing: var(--feather-headline1-letter-spacing);
  font-weight: var(--feather-headline1-font-weight);
  font-style: var(--feather-headline1-font-style);
}

@mixin headline2 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-headline2-font-size);
  line-height: var(--feather-headline2-line-height);
  letter-spacing: var(--feather-headline2-letter-spacing);
  font-weight: var(--feather-headline2-font-weight);
  font-style: var(--feather-headline2-font-style);
}

@mixin headline3 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-headline3-font-size);
  line-height: var(--feather-headline3-line-height);
  letter-spacing: var(--feather-headline3-letter-spacing);
  font-weight: var(--feather-headline3-font-weight);
  font-style: var(--feather-headline3-font-style);
}

@mixin headline4 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-headline4-font-size);
  line-height: var(--feather-headline4-line-height);
  letter-spacing: var(--feather-headline4-letter-spacing);
  font-weight: var(--feather-headline4-font-weight);
  font-style: var(--feather-headline4-font-style);
}

@mixin subtitle1 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-subtitle1-font-size);
  line-height: var(--feather-subtitle1-line-height);
  letter-spacing: var(--feather-subtitle1-letter-spacing);
  font-weight: var(--feather-subtitle1-font-weight);
  font-style: var(--feather-subtitle1-font-style);
}

@mixin subtitle2 {
  font-family: var(--feather-font-family);
  font-size: var(--feather-subtitle2-font-size);
  line-height: var(--feather-subtitle2-line-height);
  letter-spacing: var(--feather-subtitle2-letter-spacing);
  font-weight: var(--feather-subtitle2-font-weight);
  font-style: var(--feather-subtitle2-font-style);
}

@mixin body-large {
  font-family: var(--feather-font-family);
  font-size: var(--feather-body-large-font-size);
  line-height: var(--feather-body-large-line-height);
  letter-spacing: var(--feather-body-large-letter-spacing);
  font-weight: var(--feather-body-large-font-weight);
  font-style: var(--feather-body-large-font-style);
}

@mixin body-small {
  font-family: var(--feather-font-family);
  font-size: var(--feather-body-small-font-size);
  line-height: var(--feather-body-small-line-height);
  letter-spacing: var(--feather-body-small-letter-spacing);
  font-weight: var(--feather-body-small-font-weight);
  font-style: var(--feather-body-small-font-style);
}

@mixin caption {
  font-family: var(--feather-font-family);
  font-size: var(--feather-caption-font-size);
  line-height: var(--feather-caption-line-height);
  letter-spacing: var(--feather-caption-letter-spacing);
  font-weight: var(--feather-caption-font-weight);
  font-style: var(--feather-caption-font-style);
}

@mixin overline {
  font-family: var(--feather-font-family);
  font-size: var(--feather-overline-font-size);
  line-height: var(--feather-overline-line-height);
  letter-spacing: var(--feather-overline-letter-spacing);
  font-weight: var(--feather-overline-font-weight);
  font-style: var(--feather-overline-font-style);
  text-transform: uppercase;
}

@mixin button {
  font-family: var(--feather-font-family);
  font-size: var(--feather-body-small-font-size);
  font-weight: var(--feather-font-semibold);
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

// console is a non-standard Feather mixin (monospace code blocks)
@mixin console {
  font-family: monospace;
  font-size: 0.85rem;
  line-height: 1.5;
}
```

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/_typography.scss
git commit -m "feat(styles): add local _typography.scss to replace @featherds/styles/mixins/typography"
```

---

### Task 3: Create `_elevation.scss` and `_utils.scss`

**Files:**
- Create: `ui/src/styles/_elevation.scss`
- Create: `ui/src/styles/_utils.scss`

- [ ] **Step 1: Create `_elevation.scss`**

```scss
// ui/src/styles/_elevation.scss
//
// Local replacement for @featherds/styles/mixins/elevation.
// elevation(N) sets box-shadow and background-color via --feather-* CSS vars.

@mixin elevation($i) {
  @if $i >= 0 and $i <= 24 {
    box-shadow: var(--feather-shadow-#{$i});
  }
  @if      $i == 0  { background-color: var(--feather-elevation-background-0);  }
  @else if $i == 1  { background-color: var(--feather-elevation-background-1);  }
  @else if $i == 2  { background-color: var(--feather-elevation-background-2);  }
  @else if $i == 3  { background-color: var(--feather-elevation-background-3);  }
  @else if $i == 4  { background-color: var(--feather-elevation-background-4);  }
  @else if $i == 6  { background-color: var(--feather-elevation-background-6);  }
  @else if $i == 8  { background-color: var(--feather-elevation-background-8);  }
  @else if $i == 12 { background-color: var(--feather-elevation-background-12); }
  @else if $i == 16 { background-color: var(--feather-elevation-background-16); }
  @else if $i == 24 { background-color: var(--feather-elevation-background-24); }
}
```

- [ ] **Step 2: Create `_utils.scss`**

```scss
// ui/src/styles/_utils.scss
//
// Local replacement for @featherds/styles/themes/utils.
// Only alpha() is used in our source; all other Feather util functions are omitted.

// alpha($color, $alpha)
// $color — a Feather SCSS variable that resolves to --feather-<name>
// The Feather theme provides companion -r/-g/-b custom properties for each colour token.
// Example: alpha(variables.$error, 0.2) → rgba(var(--feather-error-r), var(--feather-error-g), var(--feather-error-b), 0.2)
@function alpha($color, $alpha) {
  $r: var(#{$color + "-r"});
  $g: var(#{$color + "-g"});
  $b: var(#{$color + "-b"});
  @return rgba($r, $g, $b, $alpha);
}
```

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/_elevation.scss src/styles/_utils.scss
git commit -m "feat(styles): add local _elevation.scss and _utils.scss to replace Feather mixins"
```

---

### Task 4: Batch-replace `themes/variables` imports

**Files:**
- Modify: all 210+ `.vue`/`.scss` files that import `@featherds/styles/themes/variables`

There are four patterns to replace:
1. `@import "@featherds/styles/themes/variables";` → `@import "@/styles/tokens";`
2. `@import '@featherds/styles/themes/variables';` → `@import "@/styles/tokens";`
3. `@use "@featherds/styles/themes/variables";` → `@use "@/styles/tokens";`
4. `@use '@featherds/styles/themes/variables'` + `as fvars` / `as variables` / plain — these need individual handling

- [ ] **Step 1: Count the import instances (baseline)**

```bash
grep -rl "@featherds/styles/themes/variables" src/ | wc -l
```

Note the count. You will verify it reaches 0 after this task.

- [ ] **Step 2: Replace bare `@import` forms (double and single quotes)**

```bash
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@import "@featherds/styles/themes/variables";|@import "@/styles/tokens";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@import '@featherds/styles/themes/variables';|@import \"@/styles/tokens\";|g"
```

- [ ] **Step 3: Replace `@use` forms**

```bash
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/themes/variables";|@use "@/styles/tokens";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/themes/variables';|@use \"@/styles/tokens\";|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/themes/variables" as variables;|@use "@/styles/tokens" as variables;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/themes/variables" as fvars;|@use "@/styles/tokens" as fvars;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/themes/variables' as fvars;|@use \"@/styles/tokens\" as fvars;|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/themes/variables"|@use "@/styles/tokens"|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/themes/variables'|@use \"@/styles/tokens\"|g"
```

- [ ] **Step 4: Verify count is zero**

```bash
grep -rl "@featherds/styles/themes/variables" src/ | wc -l
```

Expected: `0`

- [ ] **Step 5: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors. If any SASS error mentions an unknown variable (`$primary-text-on-surface` etc.), the corresponding file has a `@use` namespace alias that wasn't caught. Find it with:
```bash
grep -rn "featherds/styles/themes/variables" src/
```
Fix manually by updating that one file's import.

- [ ] **Step 6: Commit**

```bash
git add -p  # stage only src/ changes
git commit -m "refactor(styles): replace @featherds/styles/themes/variables imports with local _tokens.scss"
```

---

### Task 5: Batch-replace `mixins/typography` imports

**Files:**
- Modify: ~92 files with typography mixin imports

Patterns to replace:
1. `@import "@featherds/styles/mixins/typography";` → `@import "@/styles/typography";`
2. `@import '@featherds/styles/mixins/typography';` → same
3. `@use "@featherds/styles/mixins/typography";` → `@use "@/styles/typography";`
4. `@use "@featherds/styles/mixins/typography" as typo;` → `@use "@/styles/typography" as typo;`
5. `@use "@featherds/styles/mixins/_typography.scss" as typo;` → `@use "@/styles/typography" as typo;`
6. `@use "@featherds/styles/mixins/typography" as typography;` → `@use "@/styles/typography" as typography;`
7. `@use "@featherds/styles/mixins/typography"` (no alias) → `@use "@/styles/typography"`

- [ ] **Step 1: Count baseline**

```bash
grep -rl "@featherds/styles/mixins/typography\|@featherds/styles/mixins/_typography" src/ | wc -l
```

- [ ] **Step 2: Batch replace**

```bash
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@import "@featherds/styles/mixins/typography";|@import "@/styles/typography";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@import '@featherds/styles/mixins/typography';|@import \"@/styles/typography\";|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/typography" as typo;|@use "@/styles/typography" as typo;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/_typography.scss" as typo;|@use "@/styles/typography" as typo;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/typography" as typography;|@use "@/styles/typography" as typography;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/typography";|@use "@/styles/typography";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/mixins/typography';|@use \"@/styles/typography\";|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/mixins/typography'|@use \"@/styles/typography\"|g"
```

- [ ] **Step 3: Verify count is zero**

```bash
grep -rl "@featherds/styles/mixins/typography\|@featherds/styles/mixins/_typography" src/ | wc -l
```

Expected: `0`

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "refactor(styles): replace @featherds/styles/mixins/typography imports with local _typography.scss"
```

---

### Task 6: Batch-replace `mixins/elevation` imports

**Files:**
- Modify: ~35 files with elevation mixin imports

Patterns:
1. `@import "@featherds/styles/mixins/elevation";`
2. `@import '@featherds/styles/mixins/elevation';`
3. `@use "@featherds/styles/mixins/elevation";`
4. `@use "@featherds/styles/mixins/elevation" as elevation;`

- [ ] **Step 1: Count baseline**

```bash
grep -rl "@featherds/styles/mixins/elevation" src/ | wc -l
```

- [ ] **Step 2: Batch replace**

```bash
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@import "@featherds/styles/mixins/elevation";|@import "@/styles/elevation";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@import '@featherds/styles/mixins/elevation';|@import \"@/styles/elevation\";|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/elevation";|@use "@/styles/elevation";|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/mixins/elevation" as elevation;|@use "@/styles/elevation" as elevation;|g'
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/mixins/elevation';|@use \"@/styles/elevation\";|g"
```

- [ ] **Step 3: Verify count is zero**

```bash
grep -rl "@featherds/styles/mixins/elevation" src/ | wc -l
```

Expected: `0`

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "refactor(styles): replace @featherds/styles/mixins/elevation imports with local _elevation.scss"
```

---

### Task 7: Batch-replace `themes/utils` imports and fix `_severities.scss`

**Files:**
- Modify: `ui/src/styles/_severities.scss` (uses `utils.alpha()` and `variables.*`)
- Modify: any other file with `@use '@featherds/styles/themes/utils'`

`_severities.scss` uses `@use '@featherds/styles/themes/utils'` and `@use '@featherds/styles/themes/variables'`. After Task 4 the variables import is already fixed. This task fixes the utils import.

- [ ] **Step 1: Count baseline**

```bash
grep -rl "@featherds/styles/themes/utils" src/ | wc -l
```

- [ ] **Step 2: Batch replace**

```bash
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  "s|@use '@featherds/styles/themes/utils';|@use \"@/styles/utils\";|g"
find src/ -name "*.vue" -o -name "*.scss" | xargs sed -i '' \
  's|@use "@featherds/styles/themes/utils";|@use "@/styles/utils";|g'
```

- [ ] **Step 3: Verify count is zero**

```bash
grep -rl "@featherds/styles/themes/utils" src/ | wc -l
```

Expected: `0`

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 5: Commit**

```bash
git add -p
git commit -m "refactor(styles): replace @featherds/styles/themes/utils imports with local _utils.scss"
```

---

### Task 8: Update global stylesheets and vite.config.ts

**Files:**
- Modify: `ui/src/styles/opennms-feather-styles.scss`
- Modify: `ui/vite.config.ts`

`opennms-feather-styles.scss` uses `@use "@featherds/styles/mixins/_typography.scss" as typo` which was not caught by the Task 5 batch (it references the internal `_typography.scss` filename directly, not the public path). It also uses `@use "@featherds/styles/themes/variables"`. Check and fix both.

The `vite.config.ts` `~@featherds` alias was needed for `@import '~@featherds/...'` SCSS patterns. Once all SCSS imports are removed, the alias and its associated `sassOptions.loadPaths` entry can be removed.

- [ ] **Step 1: Check what's left in opennms-feather-styles.scss**

```bash
grep "featherds" src/styles/opennms-feather-styles.scss
```

- [ ] **Step 2: Fix remaining imports in opennms-feather-styles.scss**

The top of the file currently has:
```scss
@use "@featherds/styles/mixins/_typography.scss" as typo;
@use "@featherds/styles/themes/variables";
@use '@/styles/vars' as vars;
```

Change to:
```scss
@use "@/styles/typography" as typo;
@use "@/styles/tokens";
@use '@/styles/vars' as vars;
```

Read the file first and make the exact edit.

- [ ] **Step 3: Fix bare `$border-radius-surface` usages**

Four files use `$border-radius-surface` without a `vars.` prefix — they accidentally rely on the Feather variables import providing it. After Task 4 replaces that import, the variable will come from `_tokens.scss` which does NOT define `$border-radius-surface` (it's not a Feather CSS var — it's a local SCSS constant in `vars.scss`). Fix these files by changing the bare reference to `vars.$border-radius-surface` and ensuring each file has `@use '@/styles/vars' as vars;` at the top.

Files affected (check with `grep -rn "border-radius-surface" src/ | grep -v "vars\."` after Task 4):
- `src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue`
- `src/components/WallboardConfig/DashletRow.vue`
- `src/components/Menu/Search.vue`

For each file, make two changes:
1. Add `@use '@/styles/vars' as vars;` to the `<style>` block if not present
2. Change `border-radius: $border-radius-surface;` → `border-radius: vars.$border-radius-surface;`

Build after to confirm no SCSS errors.

- [ ] **Step 4: Verify no featherds imports remain anywhere in src/**

```bash
grep -r "featherds/styles" src/ --include="*.vue" --include="*.scss" --include="*.ts"
```

Expected: zero output. If any lines appear, fix them manually.

- [ ] **Step 5: Remove the `~@featherds` alias from vite.config.ts**

In `vite.config.ts`, find and remove the alias entry:
```ts
'~@featherds': '@featherds',
```

Also check if there is a `sassOptions.loadPaths` entry for `@featherds` stubs that was added by the previous subagent and remove it if it's no longer needed.

- [ ] **Step 6: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 7: Commit**

```bash
git add src/styles/opennms-feather-styles.scss vite.config.ts \
  src/components/SurveillanceViewsConfig/SurveillanceViewRowColumnEditor.vue \
  src/components/WallboardConfig/DashletRow.vue \
  src/components/Menu/Search.vue
git commit -m "refactor(styles): remove remaining @featherds/styles imports from global stylesheets"
```

---

### Task 9: Remove `@featherds/styles` from package.json and final verification

**Files:**
- Modify: `ui/package.json` (via pnpm)

`@featherds/megamenu` (kept) depends on `@featherds/styles` transitively, so the package stays in `node_modules`. We are removing it from our **direct** dependencies only. The three `import '@featherds/styles*'` lines in `main.ts` will still work because the package is present transitively.

- [ ] **Step 1: Remove the direct dependency**

```bash
pnpm remove @featherds/styles
```

Expected output ends with `Done in Xs`.

- [ ] **Step 2: Confirm it's still in node_modules (transitive)**

```bash
ls node_modules/@featherds/styles/package.json
```

Expected: file exists (installed as peer of megamenu). If it does NOT exist, the `import '@featherds/styles*'` lines in `main.ts` will fail. In that case add `@featherds/styles` back as a direct dependency.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Final scan — zero direct Feather style imports in src/**

```bash
grep -r "@featherds/styles" src/ --include="*.vue" --include="*.scss" --include="*.ts"
```

Expected: **zero lines**.

- [ ] **Step 5: Confirm only megamenu reference remains in all of src/**

```bash
grep -r "@featherds" src/ --include="*.vue" --include="*.scss" --include="*.ts"
```

Expected: only lines in `src/components/Common/ShimFeatherMegaMenu/index.ts` and its `.d.ts`.

- [ ] **Step 6: Deploy to test container and verify both themes**

```bash
../ui/deploy-to-container.sh test-opennms
```

Open `http://localhost:8980/opennms/ui/` in the browser.

**Light mode checklist** (toggle off dark mode):
- [ ] Node list table renders with correct row striping and border colors
- [ ] Severity badges (Critical/Major/Minor/Warning/Normal) have correct fill colors
- [ ] Alarms table severity row tinting visible
- [ ] BreadCrumb bar is white surface on blue-gray background (not invisible)
- [ ] Typography — headlines, body text, captions — look unchanged
- [ ] Cards/panels have visible elevation (slight shadow / background step)

**Dark mode checklist** (toggle on dark mode):
- [ ] Same table/badge/tinting checks
- [ ] Dark surfaces are zinc gray (not purple-navy from stock Feather theme)
- [ ] PrimeVue components (inputs, dialogs, dropdowns) match dark surface colors

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): remove @featherds/styles from direct dependencies (Phase 2 complete)"
```

---

## Testing Summary

Each task above ends with `pnpm build`. The full test sequence for the completed Phase 2 is:

| Check | Command | Expected |
|---|---|---|
| SCSS compiles | `pnpm build` | `✓ built in` |
| No Feather style imports | `grep -r "@featherds/styles" src/` | zero lines |
| Only megamenu reference remains | `grep -r "@featherds" src/` | 2 lines in ShimFeatherMegaMenu only |
| Package not in direct deps | `grep "@featherds/styles" package.json` | zero lines |
| Package still available (transitive) | `ls node_modules/@featherds/styles/` | exists |
| Light mode visual | Browser at `/ui/` | severity colors, surface, elevation unchanged |
| Dark mode visual | Browser at `/ui/` | zinc palette, no purple-navy surfaces |

---

## What Phase 2 Does NOT Do

- Does **not** rename `--feather-*` CSS custom properties in the DOM. Components will still receive colors via `--feather-surface` etc. at runtime (from `open-light/dark.css` loaded in `main.ts`).
- Does **not** remove `@featherds/styles` from node_modules entirely (it stays as a transitive dep of `@featherds/megamenu`).
- Does **not** change any `var($surface)` call sites — they still work identically because `_tokens.scss` declares the same variable names.
- Does **not** remove the `@featherds/megamenu` package or the `ShimFeatherMegaMenu` component.
- Does **not** migrate `--feather-*` CSS var references in inline styles or JavaScript — only SCSS `@import`/`@use` paths are changed.

A potential Phase 3 would: replace the runtime `--feather-*` CSS custom properties with either pure `--p-*` PrimeVue tokens or a custom `--onms-*` namespace, making the app fully independent of even the CSS output of `@featherds/styles`.
