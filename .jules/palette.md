## 2024-05-22 - Accessibility Attributes for Core Layout Controls
**Learning:** Accessibility compliance in the UI requires that stateful icon-only toggles (like sidebar menus) include `aria-expanded` reflecting their open/closed state, and icon buttons mapped to keyboard shortcuts (like floating action buttons) include `aria-keyshortcuts`.
**Action:** Always add appropriate `aria-label`, `aria-expanded` and `aria-keyshortcuts` to interactive components during UI layout design.
