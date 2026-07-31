# TeamGraph

**Accessible org charts and team directories for WordPress.** Chart, grid, and list views from one block or shortcode — built as semantic HTML, with a drag-and-drop React admin and a dependency-free front end.

[![WordPress](https://img.shields.io/badge/WordPress-6.4%2B-blue)](https://wordpress.org/)
[![PHP](https://img.shields.io/badge/PHP-8.0%2B-777bb4)](https://www.php.net/)
[![License](https://img.shields.io/badge/license-GPL--2.0%2B-green)](https://www.gnu.org/licenses/gpl-2.0.html)

---

## Why TeamGraph

Most org chart plugins draw a diagram and bolt a text alternative onto it. TeamGraph inverts that: **the chart _is_ a nested list**, laid out with pure CSS.

- Screen readers announce the reporting hierarchy natively — no ARIA tree emulation
- Visitors without JavaScript get the complete, expanded chart
- On phones the tree reflows into a readable indented list instead of a pinch-zoom diagram
- Default colors pass WCAG AA; custom color guides are contrast-checked live as you edit
- Prints cleanly, fully expanded

No jQuery. No front-end framework. One small script and stylesheet, loaded only on pages where a chart actually appears.

## Features

### Front end

Three views from a single block or shortcode:

| View | What it is |
| --- | --- |
| `tree` | Org chart with CSS connector lines |
| `grid` | Card grid with live type-to-filter |
| `list` | Directory list, collapsible |

Member cards carry a photo, name, job title, email, phone, and profile link. Any view can be filtered to one department or location, or rooted at a single member to chart just that branch. Department pills appear automatically where a branch's assignment changes, and color guides style branches with your brand colors, inherited down the tree.

### Admin

Fast React screens under **TeamGraph**:

- **Team Members** — instant search, sortable columns, pagination, bulk delete
- **Add/Edit Member** — biography, department, location, photo, live card preview, and a manager picker that never offers a choice which would create a reporting cycle
- **Chart Builder** — drag onto a member to change their manager, drag above/below to reorder; live tree search and a slide-in editing drawer
- **Organization** — manage departments and locations in one place
- **Theme** — color guides up to eight levels deep, with live WCAG contrast warnings
- **Settings** — one-click sample data, CSV import/export with a downloadable template, and uninstall data controls

## Usage

Insert the **TeamGraph Chart** block, or use the shortcode:

```
[teamgraph]
[teamgraph view="grid" department="Marketing"]
[teamgraph view="list" location="berlin"]
[teamgraph root="123"]
```

| Attribute | Default | Notes |
| --- | --- | --- |
| `view` | `tree` | `tree`, `grid`, or `list` |
| `root` | `0` | Member ID to chart from; `0` charts the whole org |
| `department` | — | Term ID, slug, or name |
| `location` | — | Term ID, slug, or name |
| `showtools` | — | Show the front-end tools bar |
| `viewswitch` | — | Offer a view switcher (suppressed when `view` is set explicitly) |

Department and location filters prune the tree: matching nodes keep their mutual reporting lines, and matching descendants of non-matching members are promoted.

## Installation

Download a release ZIP and install it through **Plugins → Add New → Upload Plugin**, or clone into your plugins directory and build:

```bash
git clone https://github.com/23bitstudio/teamgraph.git
cd teamgraph
npm install
npm run build
```

**Requires:** WordPress 6.4+, PHP 8.0+

## Development

```bash
npm install
npm run build        # production build → build/
npm start            # watch mode
npm run plugin-zip   # distributable ZIP (honors .distignore)
```

- Admin source is `src/admin/` — all screens share one bundle and mount by the root element's `data-page` attribute. The block editor bundle is `src/block/`.
- The front end is hand-written vanilla JS/CSS in `assets/frontend/` — no build step, no dependencies.

### Data model

| Concept | Storage |
| --- | --- |
| Member | CPT `teamgraph_member` |
| Reports to | `post_parent` |
| Sibling order | `menu_order` |
| Biography | `post_content` |
| Department | Flat taxonomy `teamgraph_department` (inherits from manager) |
| Location | Flat taxonomy `teamgraph_location` (no inheritance) |
| Color guides | Option `teamgraph_groups` |
| Settings | Option `teamgraph_settings` |

The REST namespace `teamgraph/v1` re-checks every safeguard the UI enforces — capabilities per action, reporting-cycle prevention, and hex color validation. Deleting a member re-parents their direct reports to that member's own manager before trashing, so branches are never orphaned and deletes are never blocked.

### Extending

PHP filters: `teamgraph_member_fields`, `teamgraph_member_record`, `teamgraph_tree_node`, `teamgraph_shortcode_atts`, `teamgraph_render_view`, `teamgraph_admin_pages`, `teamgraph_admin_data`, `teamgraph_capability`.

JS hooks (`wp.hooks`): `teamgraph.adminPages`, `teamgraph.memberFormFields`, `teamgraph.memberColumns`, `teamgraph.blockViews`.

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the full extension surface and [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) for the accessibility contract and manual test checklist.

## Privacy

TeamGraph makes no external requests and collects nothing. All data stays in your WordPress database. Uninstalling keeps your data unless you enable **Delete all data on uninstall** under TeamGraph → Settings.

## License

GPL-2.0-or-later. See [LICENSE](https://www.gnu.org/licenses/gpl-2.0.html).

Built by [23Bit Studio](https://23bitstudio.com). Plugin home: [getteamgraph.com](https://getteamgraph.com).
