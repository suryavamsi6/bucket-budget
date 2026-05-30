## 2024-05-30 - Added ARIA Attributes to Global Icon Buttons
**Learning:** Found that globally important navigational and quick-action icon buttons (Sidebar Toggle, Theme Toggle, Quick Add FAB) in the core `App.jsx` layout lacked essential screen reader support and tooltip context.
**Action:** Always verify that icon-only `Button` elements, especially those serving as primary layout or action controls, have explicit `aria-label` and `title` attributes. Use `aria-expanded` for stateful toggles and `aria-keyshortcuts` where global hotkeys are supported.
