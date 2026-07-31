/**
 * Settings screen, in four tabs: General (data retention on uninstall),
 * Sample Data (load/remove the demo organization), CSV Import & Export, and a
 * CSV Guide with the file format and a downloadable template.
 */

import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api } from '../api';
import { ConfirmDialog, Spinner } from '../components';
import { toast } from '../toast';
import Docs from './Docs';

/**
 * The import/export file format, in column order. Mirrors the server's
 * TeamGraph_CSV::COLUMNS; the guide table and template are generated from it.
 */
const CSV_COLUMNS = [
	{
		key: 'name',
		required: true,
		description: __(
			'Full name. A row whose name matches an existing member updates that member instead of creating a duplicate.',
			'teamgraph'
		),
		example: 'Avery Chen',
	},
	{
		key: 'job_title',
		description: __( 'Shown under the name on cards.', 'teamgraph' ),
		example: 'Chief Executive Officer',
	},
	{
		key: 'email',
		description: __( 'Contact email shown on cards.', 'teamgraph' ),
		example: 'avery@example.com',
	},
	{
		key: 'phone',
		description: __( 'Contact phone shown on cards.', 'teamgraph' ),
		example: '+1 555 010 1234',
	},
	{
		key: 'link_url',
		description: __( 'Optional profile link; the name on the card links to it.', 'teamgraph' ),
		example: 'https://example.com/avery',
	},
	{
		key: 'department',
		description: __(
			'Department name — created automatically if it doesn’t exist yet. Leave empty to inherit the manager’s department.',
			'teamgraph'
		),
		example: 'Executive',
	},
	{
		key: 'location',
		description: __( 'Location name — created automatically if it doesn’t exist yet.', 'teamgraph' ),
		example: 'New York',
	},
	{
		key: 'manager',
		description: __(
			'The manager’s name, exactly as it appears in their own row (row order doesn’t matter). Leave empty for top-level members.',
			'teamgraph'
		),
		example: '',
	},
	{
		key: 'bio',
		description: __( 'Biography. Plain text or simple HTML.', 'teamgraph' ),
		example: 'Founded the company in 2015.',
	},
];

const TEMPLATE_ROWS = [
	[ 'Avery Chen', 'Chief Executive Officer', 'avery@example.com', '+1 555 010 1234', '', 'Executive', 'New York', '', 'Founded the company in 2015.' ],
	[ 'Jordan Lee', 'VP of Marketing', 'jordan@example.com', '', '', 'Marketing', 'New York', 'Avery Chen', '' ],
	[ 'Sam Ortiz', 'Product Designer', 'sam@example.com', '', 'https://example.com/sam', '', 'Remote', 'Jordan Lee', '' ],
];

function csvEscape( value ) {
	const text = String( value ?? '' );
	return /[",\n]/.test( text ) ? `"${ text.replace( /"/g, '""' ) }"` : text;
}

function downloadCsv( filename, content ) {
	const blob = new Blob( [ content ], { type: 'text/csv;charset=utf-8' } );
	const url = URL.createObjectURL( blob );
	const link = document.createElement( 'a' );
	link.href = url;
	link.download = filename;
	document.body.appendChild( link );
	link.click();
	link.remove();
	URL.revokeObjectURL( url );
}

function templateCsv() {
	const header = CSV_COLUMNS.map( ( column ) => column.key );
	return [ header, ...TEMPLATE_ROWS ]
		.map( ( row ) => row.map( csvEscape ).join( ',' ) )
		.join( '\n' );
}

const TABS = [
	{ id: 'general', label: __( 'General', 'teamgraph' ) },
	{ id: 'sample-data', label: __( 'Sample Data', 'teamgraph' ) },
	{ id: 'csv', label: __( 'CSV Import & Export', 'teamgraph' ) },
	{ id: 'csv-guide', label: __( 'CSV Guide', 'teamgraph' ) },
	{ id: 'docs', label: __( 'Docs', 'teamgraph' ) },
];

function Tabs( { active, onChange } ) {
	const refs = useRef( {} );

	const onKeyDown = ( event ) => {
		const index = TABS.findIndex( ( tab ) => tab.id === active );
		let next = -1;
		if ( event.key === 'ArrowRight' ) {
			next = ( index + 1 ) % TABS.length;
		} else if ( event.key === 'ArrowLeft' ) {
			next = ( index - 1 + TABS.length ) % TABS.length;
		} else if ( event.key === 'Home' ) {
			next = 0;
		} else if ( event.key === 'End' ) {
			next = TABS.length - 1;
		}
		if ( next !== -1 ) {
			event.preventDefault();
			onChange( TABS[ next ].id );
			refs.current[ TABS[ next ].id ]?.focus();
		}
	};

	return (
		<div
			className="teamgraph-section-tabs"
			role="tablist"
			aria-label={ __( 'Settings sections', 'teamgraph' ) }
		>
			{ TABS.map( ( tab ) => (
				<button
					key={ tab.id }
					ref={ ( el ) => ( refs.current[ tab.id ] = el ) }
					type="button"
					role="tab"
					id={ `teamgraph-tab-${ tab.id }` }
					aria-selected={ tab.id === active }
					aria-controls={ `teamgraph-panel-${ tab.id }` }
					tabIndex={ tab.id === active ? 0 : -1 }
					className={ tab.id === active ? 'is-active' : '' }
					onClick={ () => onChange( tab.id ) }
					onKeyDown={ onKeyDown }
				>
					{ tab.label }
				</button>
			) ) }
		</div>
	);
}

function TabPanel( { id, active, children } ) {
	return (
		<div
			role="tabpanel"
			id={ `teamgraph-panel-${ id }` }
			aria-labelledby={ `teamgraph-tab-${ id }` }
			hidden={ id !== active }
			className="teamgraph-tab-panel"
		>
			{ children }
		</div>
	);
}

export default function Settings() {
	const [ tab, setTab ] = useState( 'general' );
	const [ settings, setSettings ] = useState( null );
	const [ demoExists, setDemoExists ] = useState( false );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ seeding, setSeeding ] = useState( false );
	const [ removing, setRemoving ] = useState( false );
	const [ confirmingRemove, setConfirmingRemove ] = useState( false );
	const [ exporting, setExporting ] = useState( false );
	const [ importing, setImporting ] = useState( false );
	const [ importFile, setImportFile ] = useState( null );
	const [ importResult, setImportResult ] = useState( null );

	useEffect( () => {
		( async () => {
			try {
				const [ loadedSettings, demo ] = await Promise.all( [
					api.get( '/settings' ),
					api.get( '/demo' ),
				] );
				setSettings( loadedSettings );
				setDemoExists( demo.exists );
			} catch ( err ) {
				toast.error( err.message );
			} finally {
				setLoading( false );
			}
		} )();
	}, [] );

	const save = async ( event ) => {
		event.preventDefault();
		setSaving( true );
		try {
			setSettings( await api.put( '/settings', settings ) );
			toast.success( __( 'Settings saved.', 'teamgraph' ) );
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setSaving( false );
		}
	};

	const seedDemo = async () => {
		setSeeding( true );
		try {
			await api.post( '/demo' );
			setDemoExists( true );
			toast.success(
				__( 'Sample organization loaded. Take a look at the Chart Builder to see it.', 'teamgraph' )
			);
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setSeeding( false );
		}
	};

	const removeDemo = async () => {
		setConfirmingRemove( false );
		setRemoving( true );
		try {
			const result = await api.del( '/demo' );
			setDemoExists( false );
			toast.success(
				sprintf(
					/* translators: %d: number of members removed. */
					__( 'Sample data removed (%d members).', 'teamgraph' ),
					result.members
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setRemoving( false );
		}
	};

	const exportCsv = async () => {
		setExporting( true );
		try {
			const { filename, content } = await api.get( '/csv/export' );
			downloadCsv( filename, content );
			toast.success( __( 'Members exported.', 'teamgraph' ) );
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setExporting( false );
		}
	};

	const importCsv = async () => {
		if ( ! importFile ) {
			return;
		}
		setImporting( true );
		setImportResult( null );
		try {
			const csv = await importFile.text();
			const result = await api.post( '/csv/import', { csv } );
			setImportResult( result );
			toast.success(
				sprintf(
					/* translators: 1: created count, 2: updated count, 3: skipped count. */
					__( 'Import finished: %1$d created, %2$d updated, %3$d skipped.', 'teamgraph' ),
					result.created,
					result.updated,
					result.skipped
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setImporting( false );
		}
	};

	if ( loading ) {
		return (
			<div className="teamgraph-screen">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="teamgraph-screen">
			<header className="teamgraph-screen-header">
				<h1>{ __( 'Settings', 'teamgraph' ) }</h1>
			</header>

			<Tabs active={ tab } onChange={ setTab } />

			<TabPanel id="general" active={ tab }>
				{ settings && (
					<form onSubmit={ save }>
						<label className="teamgraph-field teamgraph-field-checkbox">
							<input
								type="checkbox"
								checked={ settings.delete_on_uninstall }
								onChange={ ( event ) =>
									setSettings( { ...settings, delete_on_uninstall: event.target.checked } )
								}
							/>
							<span>
								{ __(
									'Delete all TeamGraph data when the plugin is uninstalled',
									'teamgraph'
								) }
								<small className="teamgraph-muted">
									{ __(
										'Members, departments, locations, and styling groups are removed permanently when the plugin is deleted from the Plugins screen. Leave off to keep data through a reinstall.',
										'teamgraph'
									) }
								</small>
							</span>
						</label>

						<div className="teamgraph-form-actions">
							<button type="submit" className="teamgraph-button-primary" disabled={ saving }>
								{ saving ? __( 'Saving…', 'teamgraph' ) : __( 'Save Settings', 'teamgraph' ) }
							</button>
						</div>
					</form>
				) }
			</TabPanel>

			<TabPanel id="sample-data" active={ tab }>
				<section className="teamgraph-settings-section">
					<h2>{ __( 'Sample data', 'teamgraph' ) }</h2>
					{ demoExists ? (
						<>
							<p className="teamgraph-muted">
								{ __(
									'The sample organization is loaded. Removing it deletes only the seeded members, departments, locations, and color guide — your own content is untouched.',
									'teamgraph'
								) }
							</p>
							<button
								type="button"
								className="teamgraph-button-secondary teamgraph-danger-link"
								disabled={ removing }
								onClick={ () => setConfirmingRemove( true ) }
							>
								{ removing
									? __( 'Removing…', 'teamgraph' )
									: __( 'Remove sample data', 'teamgraph' ) }
							</button>
						</>
					) : (
						<>
							<p className="teamgraph-muted">
								{ __(
									'Load a small sample organization — members, departments, locations, and a color guide — to explore TeamGraph. You can remove it again from here with one click.',
									'teamgraph'
								) }
							</p>
							<button
								type="button"
								className="teamgraph-button-primary"
								disabled={ seeding }
								onClick={ seedDemo }
							>
								{ seeding ? __( 'Loading…', 'teamgraph' ) : __( 'Load sample data', 'teamgraph' ) }
							</button>
						</>
					) }
				</section>
			</TabPanel>

			<TabPanel id="csv" active={ tab }>
				<section className="teamgraph-settings-section">
					<h2>{ __( 'Export Members', 'teamgraph' ) }</h2>
					<p className="teamgraph-muted">
						{ __(
							'Download every member as a CSV file — including job title, contact details, department, location, and manager. The file re-imports cleanly, so it doubles as a backup.',
							'teamgraph'
						) }
					</p>
					<button
						type="button"
						className="teamgraph-button-secondary"
						disabled={ exporting }
						onClick={ exportCsv }
					>
						{ exporting ? __( 'Exporting…', 'teamgraph' ) : __( 'Download CSV', 'teamgraph' ) }
					</button>
				</section>

				<section className="teamgraph-settings-section">
					<h2>{ __( 'Import Members', 'teamgraph' ) }</h2>
					<p className="teamgraph-muted">
						{ __(
							'Import members from a CSV file. Rows matching an existing member’s name update that member; new names are created. Unknown departments and locations are created automatically. See the CSV Guide tab for the format.',
							'teamgraph'
						) }
					</p>
					<div className="teamgraph-csv-import-controls">
						<label className="teamgraph-button-secondary teamgraph-file-button">
							{ importFile ? __( 'Change File', 'teamgraph' ) : __( 'Choose File', 'teamgraph' ) }
							<input
								type="file"
								accept=".csv,text/csv"
								aria-label={ __( 'CSV file to import', 'teamgraph' ) }
								onChange={ ( event ) => {
									setImportFile( event.target.files[ 0 ] || null );
									setImportResult( null );
								} }
							/>
						</label>
						{ importFile && (
							<span className="teamgraph-muted teamgraph-file-name">{ importFile.name }</span>
						) }
						{ /* Only meaningful once a file is picked, so it stays out of the way. */ }
						{ importFile && (
							<button
								type="button"
								className="teamgraph-button-primary"
								disabled={ importing }
								onClick={ importCsv }
							>
								{ importing ? __( 'Importing…', 'teamgraph' ) : __( 'Import', 'teamgraph' ) }
							</button>
						) }
					</div>
					{ importResult && importResult.warnings.length > 0 && (
						<div className="teamgraph-csv-warnings">
							<h3>{ __( 'Warnings', 'teamgraph' ) }</h3>
							<ul>
								{ importResult.warnings.map( ( warning, index ) => (
									<li key={ index }>{ warning }</li>
								) ) }
							</ul>
						</div>
					) }
				</section>
			</TabPanel>

			<TabPanel id="csv-guide" active={ tab }>
				<section className="teamgraph-settings-section teamgraph-csv-guide">
					<h2>{ __( 'CSV format', 'teamgraph' ) }</h2>
					<p className="teamgraph-muted">
						{ __( 'The first row must be a header naming the columns. Only', 'teamgraph' ) }{ ' ' }
						<code>name</code>{ ' ' }
						{ __(
							'is required — every other column is optional, and extra columns are ignored. Here’s what a file looks like:',
							'teamgraph'
						) }
					</p>

					<div
						className="teamgraph-csv-sample"
						role="region"
						aria-label={ __( 'Example CSV contents', 'teamgraph' ) }
						tabIndex="0"
					>
						<table>
							<thead>
								<tr>
									{ CSV_COLUMNS.map( ( column ) => (
										<th key={ column.key } scope="col">
											{ column.key }
										</th>
									) ) }
								</tr>
							</thead>
							<tbody>
								{ TEMPLATE_ROWS.map( ( row, rowIndex ) => (
									<tr key={ rowIndex }>
										{ row.map( ( cell, cellIndex ) => (
											<td key={ cellIndex }>{ cell }</td>
										) ) }
									</tr>
								) ) }
							</tbody>
						</table>
					</div>

					<button
						type="button"
						className="teamgraph-button-secondary"
						onClick={ () => downloadCsv( 'teamgraph-template.csv', templateCsv() ) }
					>
						{ __( 'Download template CSV', 'teamgraph' ) }
					</button>

					<h2>{ __( 'Columns', 'teamgraph' ) }</h2>
					<table className="teamgraph-csv-columns">
						<thead>
							<tr>
								<th scope="col">{ __( 'Column', 'teamgraph' ) }</th>
								<th scope="col">{ __( 'Required', 'teamgraph' ) }</th>
								<th scope="col">{ __( 'Notes', 'teamgraph' ) }</th>
							</tr>
						</thead>
						<tbody>
							{ CSV_COLUMNS.map( ( column ) => (
								<tr key={ column.key }>
									<th scope="row">
										<code>{ column.key }</code>
									</th>
									<td>{ column.required ? __( 'Yes', 'teamgraph' ) : __( 'No', 'teamgraph' ) }</td>
									<td>{ column.description }</td>
								</tr>
							) ) }
						</tbody>
					</table>
				</section>
			</TabPanel>

			<TabPanel id="docs" active={ tab }>
				<Docs />
			</TabPanel>

			{ confirmingRemove && (
				<ConfirmDialog
					title={ __( 'Remove sample data?', 'teamgraph' ) }
					message={ __(
						'All seeded sample members, departments, locations, and the sample color guide will be permanently deleted.',
						'teamgraph'
					) }
					confirmLabel={ __( 'Remove', 'teamgraph' ) }
					onConfirm={ removeDemo }
					onCancel={ () => setConfirmingRemove( false ) }
				/>
			) }
		</div>
	);
}
