## 2024-05-19 - Accessible Icon Buttons
**Learning:** Many icon-only buttons (like `removeSplit`, `changeMonth` controls, and `delete` template buttons) were missing explicit `aria-label` attributes or `title` tooltips, which makes them inaccessible to screen readers and difficult to understand without context.
**Action:** Always add explicit `aria-label` and `title` attributes to `<Button size="icon">` components to ensure accessibility and usability.
