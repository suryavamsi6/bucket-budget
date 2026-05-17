## 2024-05-15 - Accessible Icon Toggles
**Learning:** Stateful icon-only toggles (like the sidebar menu button) require `aria-expanded` attributes to properly communicate their current state to screen readers. Buttons tied to keyboard shortcuts (like the Quick Add FAB) need `aria-keyshortcuts` to inform assistive tech users about the available keyboard alternatives.
**Action:** Always include `aria-expanded` on any toggle button (menus, accordions) and map `aria-keyshortcuts` when adding global keyboard listeners.
