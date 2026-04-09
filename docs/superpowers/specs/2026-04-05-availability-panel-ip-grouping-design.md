# Availability Panel — Group by IP Address

**Date:** 2026-04-05
**Branch:** feature/jmx-config-vue
**File:** `ui/src/components/NodeDetail/AvailabilityPanel.vue`

## Problem

The availability panel renders a flat grid of service cards. Each card shows the service name, IP address, and availability percentage. When a node has multiple IP interfaces, it is not visually clear which services belong to which interface.

## Goal

Organize service cards into groups by IP address, so the interface relationship is immediately obvious.

## Design

### Layout

Each IP interface becomes a labeled section. The IP address is rendered as a small muted header row above its service cards. Service cards within a section are laid out in a flex row (wrapping), consistent with the current style.

```
[ 192.168.1.1 ]
[ ICMP 100% ]  [ HTTP 92% ]  [ HTTPS 100% ]

[ 10.0.0.5 ]
[ SNMP 99.8% ]
```

### Interface-level availability

The `iface.availability` field (server-computed minimum across all services on the interface) is **not shown**. The IP label acts as a grouping header only — the service cards carry all availability information.

### Template changes

- Outer `v-for` iterates over `availability.ipinterfaces`
- For each interface, render `.availability-panel__iface-header` (IP address label) followed by `.availability-panel__iface-cards` (flex row of service cards)
- Remove `avail-card__ip` element from each card — redundant now that IP is the section header

### Style changes

- Add `.availability-panel__iface-group` — wraps header + card row, `margin-bottom: 16px` between groups
- Add `.availability-panel__iface-header` — `subtitle2` typography, `$secondary-text-on-surface` color, `margin-bottom: 6px`
- Remove `.avail-card__ip` rule and element

### Chart timeline

The chart's `serviceLabels` already uses `${s.name} @ ${iface.address}` format. No changes needed.

## Scope

Single file: `ui/src/components/NodeDetail/AvailabilityPanel.vue`

No changes to composables, types, or parent components.
