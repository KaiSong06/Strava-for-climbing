# Design System Specification: Midnight Editorial

## 1. Overview & Creative North Star
**The Creative North Star: "The Nocturnal Architect"**

This design system transcends the standard "Dark Mode" toggle. It is an editorial-first framework designed to feel like a high-end architectural portfolio or a premium digital broadsheet. We are moving away from the "boxy" constraints of traditional SaaS dashboards toward a layout that breathes through intentional asymmetry, massive scale shifts in typography, and depth created through tonal layering rather than structural lines.

The goal is **authoritative silence**. By using a deep charcoal base (`#131313`) paired with high-contrast Inter typography, we create an environment where content feels curated, not just displayed. We break the grid by allowing elements to overlap and using "negative space" as a functional component of the hierarchy.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule

The palette is anchored in a near-black charcoal, accented by professional, high-performance blues. 

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited for sectioning.** To define boundaries, you must use background color shifts. 
*   **Surface Hierarchy:** Use the `surface-container` tiers to create "nested" depth.
    *   **Base Layer:** `surface` (#131313)
    *   **Secondary Sectioning:** `surface-container-low` (#1c1b1b)
    *   **Active/Elevated UI:** `surface-container-high` (#2a2a2a)
*   **The Glass & Gradient Rule:** For floating elements or primary CTAs, move beyond flat hex codes. Use `surface-tint` (#a8c8ff) at 10% opacity with a `backdrop-blur` of 20px to create a frosted glass effect. This allows the underlying content to "bleed" through, softening the interface.

### Primary Accents
*   **Primary:** `primary` (#a8c8ff) — Use for critical actions and high-contrast indicators.
*   **Tonal Polish:** Use a linear gradient from `primary` (#a8c8ff) to `primary-container` (#005fb8) at a 135-degree angle for Hero CTAs to provide a "lit from within" professional soul.

---

## 3. Typography: Editorial Authority

We use **Inter** exclusively, but we treat it with the reverence of a serif. The hierarchy relies on extreme contrast between `display-lg` and `body-sm` to guide the eye.

*   **Display (lg/md):** These are your "statements." Use `display-lg` (3.5rem) with a slight negative letter-spacing (-0.02em) to create a tight, editorial look.
*   **Headline (lg/md):** Use for section headers. Ensure `on-surface` (#e5e2e1) provides maximum readability against the charcoal background.
*   **Body (lg/md):** Our workhorse. `body-lg` (1rem) should be used for primary reading experiences, ensuring a line-height of at least 1.6 for breathability.
*   **Labels:** Use `label-md` (0.75rem) in `on-surface-variant` (#c2c6d4) for metadata. The reduced contrast here helps the user's eye skip to the primary content first.

---

## 4. Elevation & Depth: The Layering Principle

In this system, depth is a physical property of light and shadow, not a line on a page.

*   **Stacking Tiers:** Instead of a drop shadow, place a `surface-container-highest` (#353534) element inside a `surface-container` (#201f1f) area. This creates a natural, "milled" look.
*   **Ambient Shadows:** For floating modals, use a custom shadow: `0px 24px 48px rgba(0, 0, 0, 0.4)`. The shadow must never be pure black; it should feel like an occlusion of the ambient blue-tinted dark light.
*   **The Ghost Border Fallback:** If a container sits on an identical color and requires definition, use the `outline-variant` (#424752) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Navigation bars and floating action menus must use semi-transparent `surface-container-low` with a heavy blur. This prevents the UI from feeling "pasted on" and integrates it into the charcoal environment.

---

## 5. Components

### Buttons
*   **Primary:** A solid fill of `primary` (#a8c8ff) with `on-primary` (#003062) text. Corner radius: `md` (0.375rem).
*   **Secondary:** No fill. A "Ghost Border" of `outline` (#8c919d) at 20% opacity. 
*   **Tertiary:** Text-only in `primary` (#a8c8ff). Used for low-emphasis actions.

### Cards & Lists
*   **The Divider Ban:** Never use lines to separate list items. Use a 12px (`3`) or 16px (`4`) spacing gap or a subtle background shift to `surface-container-low`. 
*   **Card Composition:** Cards should have no border. Use `surface-container` (#201f1f) with a `lg` (0.5rem) radius.

### Input Fields
*   **Default State:** Background `surface-container-highest` (#353534), no border, with `on-surface-variant` (#c2c6d4) placeholder text.
*   **Active State:** A subtle 1px "Ghost Border" of `primary` (#a8c8ff) at 50% opacity.

### Additional Component: The "Curated Header"
A full-width section using `surface-container-lowest` (#0e0e0e) featuring `display-sm` typography and 4rem (`16`) of vertical padding. This acts as a "reset" for the user’s eyes between dense data sections.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. For example, give a header 2rem of left padding and 4rem of right padding to create a modern, editorial rhythm.
*   **Do** use `primary-fixed-dim` (#a8c8ff) for icons to ensure they "pop" against the charcoal.
*   **Do** lean into white space. If a section feels crowded, double the spacing token (e.g., move from `8` to `16`).

### Don't:
*   **Don't** use 100% white (#FFFFFF). Always use `on-surface` (#e5e2e1) to prevent eye strain.
*   **Don't** use "Drop Shadows" on cards. Use tonal shifting between `surface-container` levels.
*   **Don't** use standard dividers. If you feel the need to "cut" the page, use a background color change that spans the full width of the viewport.