## 2024-05-19 - Adding ARIA attributes to interactive layouts
**Learning:** Icon-only stateful buttons like mobile menus often forget their `aria-expanded` state, and floating action buttons mapped to keyboard shortcuts should expose those to assistive technologies using `aria-keyshortcuts`.
**Action:** Always include `aria-expanded` reflecting state on collapsible toggles, and use `aria-keyshortcuts` when `title` tooltips define keybindings.
