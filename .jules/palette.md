## 2024-06-25 - ARIA Toggles and Shortcuts
**Learning:** Stateful icon-only toggles (like the sidebar menu) need `aria-expanded` to properly communicate their current state to screen readers. Buttons that provide a keyboard shortcut (like the Quick Add FAB using Ctrl+N) should explicitly declare `aria-keyshortcuts` to aid accessibility users in discovering the keybindings.
**Action:** When creating toggle buttons or buttons with global keyboard shortcuts, always include `aria-expanded` and `aria-keyshortcuts` respectively alongside the `aria-label`.
