## 2024-06-12 - Added ARIA Labels to App.jsx Icon Buttons
**Learning:** Found several top-level, frequently used icon-only buttons (Sidebar Toggle, Theme Toggle, Quick Add FAB) lacking essential accessibility labels. This is a common pattern for Radix/Lucide icon buttons where developers forget the screen reader context.
**Action:** Always verify icon-only buttons have an `aria-label` and `title` at minimum. Stateful icons should include `aria-expanded`, and globally accessible buttons should note their `aria-keyshortcuts`.
