## 2023-10-24 - Accessibility for Core App Shell Icons
**Learning:** Stateful icon-only toggles (like sidebar menus) require `aria-expanded` and `aria-label` to be perceivable, and floating action buttons (FAB) mapped to keyboard shortcuts should include `aria-keyshortcuts` to communicate advanced navigation.
**Action:** Always verify icon-only buttons include descriptive ARIA labels, ensure stateful toggles announce their current state via `aria-expanded`, and explicitly denote associated keyboard shortcuts using `aria-keyshortcuts` to improve screen reader context.
