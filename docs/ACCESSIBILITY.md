# TeamGraph accessibility

Accessibility is TeamGraph's differentiator: the org chart **is** semantic
HTML, not a canvas or a positioned-div diagram with a bolted-on fallback.

## How the front end is built

- Every view (tree, grid, list) is a server-rendered nested `<ul>`.
  Screen readers announce the reporting hierarchy through native list
  nesting ("list, 4 items … list, 2 items"); no ARIA tree emulation needed.
- The chart layout is pure CSS (border pseudo-element connectors). With CSS
  off you get a readable nested list; with JavaScript off you get the full
  hierarchy, expanded — toggles and the filter box are *injected* by JS, so
  no-JS visitors never encounter dead controls.
- Collapse/expand toggles are real `<button>`s with `aria-expanded`,
  `aria-controls`, and a name-and-count `aria-label`.
- The filter box has a visually-hidden `<label>`, and the result count is an
  `aria-live="polite"` region.
- Headshots render the media library's alt text when set, `alt=""`
  (decorative) otherwise, since the name is always adjacent text. Initials
  fallbacks are `aria-hidden`.
- Focus is visible everywhere: `:focus-visible` outlines use `currentColor`
  inside cards so they survive any color-guide background.
- All default colors pass WCAG AA (audited; most pass AAA). Custom color
  guides are checked live in Groups & Styling — levels below 4.5:1 show a
  warning as you edit.
- Under 640px the tree becomes an indented list: no pinch-zooming a
  desktop diagram on a phone.
- Print shows everything expanded with no scroll clipping.
- Reduced motion: the front end uses no animation or transitions.

## Manual test checklist (run before each release)

Keyboard (no mouse):

1. Tab through a tree — focus lands on member links, contact links, and
   each toggle in DOM (reporting) order; the ring is visible on every stop,
   including on dark color-guide cards.
2. Activate a toggle with Enter/Space — the branch collapses, the button
   announces collapsed state, and hidden members leave the tab order.
3. In grid/list, type in the filter — results narrow live; clear it fully
   restores.

JavaScript off (disable JS in devtools, reload):

4. The full hierarchy renders expanded; no toggle buttons, no filter box,
   nothing broken.

VoiceOver (Safari, ⌘F5):

5. Navigate into the chart: VO should announce "list … items" at each
   level, so nesting depth conveys who reports to whom.
6. On a manager's card, the toggle reads "Direct reports of NAME (N),
   expanded, button"; activate it and it flips to "collapsed".
7. On a headshot with media-library alt text, VO reads it; photos without
   alt text are skipped (decorative).
8. Filter a grid: after typing, VO announces "N of M members shown"
   (live region).
9. Rotor → Links: member profile links list by name, not "link".

Zoom/reflow:

10. 200% browser zoom: no horizontal page scroll (the chart scrolls inside
    its own container); text doesn't clip.
11. Narrow window (<640px): tree reflows into the indented list.
