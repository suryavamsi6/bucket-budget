## 2024-05-12 - Core Layout Control Accessibility
**Learning:** Stateful icon toggles (like sidebar menus) require `aria-expanded` to communicate their state to screen readers. Additionally, icon buttons mapped to keyboard shortcuts (like Quick Add floating action buttons) benefit from `aria-keyshortcuts` to inform users of the shortcut.
**Action:** Always include `aria-expanded` on state-toggling buttons and `aria-keyshortcuts` on elements that have global keyboard shortcuts bound to them.
