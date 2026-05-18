## 2024-05-18 - Add ARIA labels to layout buttons
**Learning:** Icon-only buttons used in the global layout shell (like sidebar toggle, theme toggle, and the Quick Add FAB) lack screen-reader accessible names, rendering them functionally invisible or confusing to assistive technology users despite their core navigational importance.
**Action:** Always verify that layout-level navigation icons incorporate descriptive `aria-label` tags, and ensure any state-driven toggles include `aria-expanded` properties (e.g., `<Button aria-label="Toggle sidebar" aria-expanded={sidebarOpen}>`).
