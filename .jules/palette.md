
## 2024-05-10 - Adding accessibility attributes to core app navigation buttons
**Learning:** Stateful icon-only toggles require `aria-expanded` reflecting their open/closed state, and icon buttons mapped to keyboard shortcuts require `aria-keyshortcuts` to ensure full screen reader and keyboard accessibility compliance.
**Action:** Always add appropriate ARIA attributes (`aria-expanded`, `aria-keyshortcuts`, `aria-label`, `title`) to icon-only buttons depending on their stateful and keyboard-bound properties.
