/**
 * Docs tab: an in-plugin guide so users can learn TeamGraph without leaving
 * wp-admin. Static, translatable content that reuses the settings-section and
 * table styles for a consistent look with the rest of Settings.
 */

import { __ } from '@wordpress/i18n';

const SHORTCODE_ATTRS = [
	{
		attr: 'view',
		def: 'tree',
		notes: __( 'tree (org chart), grid (cards), or list (directory).', 'teamgraph' ),
	},
	{
		attr: 'root',
		def: '0',
		notes: __( 'Member ID to chart a single branch; 0 charts the whole organization.', 'teamgraph' ),
	},
	{
		attr: 'department',
		def: '—',
		notes: __( 'Term ID, slug, or name. Keeps only that department; reporting lines are preserved.', 'teamgraph' ),
	},
	{
		attr: 'location',
		def: '—',
		notes: __( 'Term ID, slug, or name. Same filtering, on the location taxonomy.', 'teamgraph' ),
	},
	{
		attr: 'showtools',
		def: '—',
		notes: __( 'Set to "true" to add zoom, expand-all, and fullscreen controls above the chart.', 'teamgraph' ),
	},
	{
		attr: 'viewswitch',
		def: '—',
		notes: __( 'Set to "true" to let visitors switch between tree, grid, and list.', 'teamgraph' ),
	},
];

export default function Docs() {
	return (
		<div className="teamgraph-docs">
			<section className="teamgraph-settings-section">
				<h2>{ __( 'Getting started', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'TeamGraph turns your team into reusable people records you manage once and display anywhere. Add members one at a time, or load a sample organization from the Sample Data tab to explore first — you can remove the sample at any time.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Adding & editing members', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'On the Team Members screen, choose Add Member. Give each person a name (required), and optionally a job title, email, phone, profile link, biography, photo, department, and location. The “Reports to” picker sets the person’s manager — it never offers a choice that would create a reporting cycle. A live preview shows the card as it will appear.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Deleting & restoring', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Deleting a member moves them to the Trash tab on the Team Members screen — nothing is lost right away. From there you can Restore them (which also re-attaches any direct reports that were moved up when you deleted them) or Delete Permanently. Emptying the trash, or WordPress’s automatic cleanup after about 30 days, removes trashed members for good.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Building the chart', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'The Chart Builder shows the whole organization as a drag-and-drop tree. Drag a member onto another to change who they report to, or drag above/below a member to reorder siblings. Use the search box to jump to anyone, and the slide-in drawer to edit without leaving the tree. Deleting a manager moves their direct reports up one level, so branches are never orphaned.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Departments & locations', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Manage these on the Organization screen, then assign them per member. A department is inherited down the reporting line until someone sets their own — so you only tag the head of each branch. Locations are individual and do not inherit. On the chart, a pill appears wherever a branch’s department changes.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Color guides (Theme)', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'On the Theme screen, create color guides with up to eight levels (card background, optional gradient, text, and pill colors). Assign a guide to a member and it styles their branch, shading each level deeper down the tree. Contrast is checked live against WCAG AA as you pick colors.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Displaying on your site', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Add the TeamGraph Chart block to any page, or use the shortcode. Both render the same three views. Examples:',
						'teamgraph'
					) }
				</p>
				<pre className="teamgraph-docs-code">
					<code>
						{ '[teamgraph]\n' +
							'[teamgraph view="grid" department="Marketing"]\n' +
							'[teamgraph view="list" location="berlin"]\n' +
							'[teamgraph root="123" showtools="true"]' }
					</code>
				</pre>
				<table className="teamgraph-csv-columns">
					<thead>
						<tr>
							<th scope="col">{ __( 'Attribute', 'teamgraph' ) }</th>
							<th scope="col">{ __( 'Default', 'teamgraph' ) }</th>
							<th scope="col">{ __( 'Notes', 'teamgraph' ) }</th>
						</tr>
					</thead>
					<tbody>
						{ SHORTCODE_ATTRS.map( ( row ) => (
							<tr key={ row.attr }>
								<th scope="row">
									<code>{ row.attr }</code>
								</th>
								<td>{ row.def }</td>
								<td>{ row.notes }</td>
							</tr>
						) ) }
					</tbody>
				</table>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Views & filtering', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Tree is the org chart with connector lines; grid is a flat card grid with type-to-filter; list is an indented directory. Department and location filters prune the tree — matching members keep their mutual reporting lines, and matching reports of a non-matching manager are promoted up.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Importing & exporting', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Use the CSV Import & Export tab to move your team in and out as a spreadsheet. The exported file re-imports cleanly, so it doubles as a backup. See the CSV Guide tab for the exact column format and a downloadable template.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Accessibility', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'Every view is semantic HTML — the chart is a nested list styled with CSS, so screen readers announce the reporting hierarchy natively, keyboard focus is visible throughout, and the chart works with JavaScript disabled. On phones it reflows into a readable indented list, and it prints cleanly.',
						'teamgraph'
					) }
				</p>
			</section>

			<section className="teamgraph-settings-section">
				<h2>{ __( 'Your data', 'teamgraph' ) }</h2>
				<p className="teamgraph-muted">
					{ __(
						'TeamGraph makes no external requests — all data stays in your WordPress database. Uninstalling keeps your team unless you enable “Delete all data on uninstall” on the General tab.',
						'teamgraph'
					) }
				</p>
			</section>
		</div>
	);
}
