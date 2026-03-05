## 2024-03-05 - Missing ARIA labels on global shell layout buttons
**Learning:** Found critical global navigation elements (sidebar toggle, theme toggle) in the main App shell lacking screen reader context. These icon-only buttons are essential for app navigation and usability.
**Action:** Always ensure top-level navigation and layout buttons have proper `aria-label` attributes and state indicators like `aria-expanded` when acting as toggles.
