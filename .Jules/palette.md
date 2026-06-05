## 2024-05-18 - Add ARIA Labels to Missing Icon Buttons
**Learning:** Several custom icon-only buttons (`size="icon"`) throughout the UI, particularly in `Budget.jsx`, are missing semantic `aria-label` or `title` attributes (e.g., month navigation, group deletion, template deletion), violating accessibility guidelines.
**Action:** Ensure that all `<Button size="icon">` components consistently include `aria-label` and `title` to provide clear context for screen readers and keyboard users.
