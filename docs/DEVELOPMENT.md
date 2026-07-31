# TeamGraph development notes

## Building

- `npm install`, then `npm run build` (or `npm start` for watch mode); output goes to `build/`.
- Admin source is `src/admin/` — all screens share one bundle and mount by the root element's `data-page` attribute. The block editor bundle is `src/block/`.
- The front end is hand-written vanilla JS/CSS in `assets/frontend/` — no build step, no dependencies, no jQuery.

## Architecture

- Members: CPT `teamgraph_member`; "reports to" is `post_parent`, sibling order is `menu_order`, bio is `post_content` (the CPT supports `editor`).
- Departments: flat taxonomy `teamgraph_department`; members default to inheriting from their manager. Locations: flat taxonomy `teamgraph_location`, no inheritance (0 = none).
- Styling groups ("color guides"): option `teamgraph_groups`, up to 8 levels per guide, inherited down subtrees, overridable mid-tree, nestable one level deep.
- REST namespace `teamgraph/v1` re-checks every safeguard the UI enforces: capabilities per action, cycle prevention, hex color validation. Deleting a member re-parents their direct reports to the member's own manager before trashing (there is no delete protection). The Builder drawer deliberately omits `bio` from its payload; REST only touches `post_content` when the payload carries the field.
- Settings: option `teamgraph_settings` (`delete_on_uninstall`); `uninstall.php` honors it.
- Demo data: `TeamGraph_Demo` seeds a tagged sample org (`_teamgraph_demo` meta) that removes cleanly.

## Extension surface

PHP filters:

- `teamgraph_member_fields` — add member meta fields (`key => [ 'meta_key', 'sanitize' ]`); they flow through REST save/read and `member_record()` automatically.
- `teamgraph_member_record` — decorate the flat member record.
- `teamgraph_tree_node( $node, $rec )` — surface extra fields on front-end tree nodes (`meta_lines` renders as extra card text).
- `teamgraph_shortcode_atts` — extend shortcode/block attributes.
- `teamgraph_render_view( '', $view, $tree, $atts )` — server-render additional view names; return non-empty (self-escaped) HTML for the container's interior. Pair with `teamgraph.blockViews` to announce the view in the editor.
- `teamgraph_admin_pages` / `teamgraph_admin_data` — register additional admin screens (rendered into the shared React mount by your own bundle keyed on `data-page`) and extend the localized `TEAMGRAPH_ADMIN` object.
- `teamgraph_capability( $cap, $context )` — remap required capabilities (`manage_members`, `manage_settings`).

JS hooks (`wp.hooks`, shared external):

- `teamgraph.adminPages` — add apps to the admin router (`data-page` → component).
- `teamgraph.memberFormFields` — add fields to Add/Edit Member (`{ key, label, type, options?, help?, render? }`); pair with `teamgraph_member_fields`.
- `teamgraph.memberColumns` — add columns to the Team Members table.
- `teamgraph.blockViews` — announce extra views to the block editor (pair with the PHP `teamgraph_render_view` filter).

Front end:

- Semantic-first: all views (`tree`, `grid`, `list`) are server-rendered accessible HTML. The tree view is a nested list laid out as an org chart with pure CSS (border pseudo-element connectors, horizontal scroll container, indented-list fallback under 640px). `assets/frontend/teamgraph-chart.js` is enhancement only: collapse/expand toggles (tree + list) and a JS-injected live filter box (grid + list). With JS off everything renders open and readable.
- Shortcode/block attributes: `view` (tree|grid|list), `root` (member id), `department`, `location` (term id; the shortcode also accepts slug or name). Department/location filters prune the tree — matching nodes keep their mutual reporting lines; matching descendants of non-matching members are promoted.