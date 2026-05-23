## 2024-05-23 - Icon-Only Button Accessibility Pattern
**Learning:** In the bucket-budget-ui project, many secondary UI actions are implemented as Radix/Tailwind icon-only buttons (`<Button size="icon">`). While visually clean, these frequently lack `aria-label`s, rendering them inaccessible to screen readers, and lack `title`s, leaving desktop users without tooltips.
**Action:** Always verify that `<Button size="icon">` components have both `aria-label` (for a11y) and `title` (for tooltips). This should be a standard check when reviewing new UI components in this design system.
