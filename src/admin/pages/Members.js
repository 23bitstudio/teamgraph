/**
 * Team Members screen: instant search, All / Top-Level / Trash tabs, sortable
 * columns, pagination, and bulk actions — replaces the native post list
 * entirely. Deleted members go to the Trash tab, where they can be restored
 * (rebuilding their branch) or permanently deleted. Bulk actions live here
 * (a flat table); the Chart Builder stays single-item since multi-select is
 * ambiguous in a drag-and-drop tree.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { api, fetchAllMembers, pages } from '../api';
import { ConfirmDialog, EmptyState, ShortcodeHelp, Spinner, useDebounced } from '../components';
import { toast } from '../toast';
import { PencilIcon, RestoreIcon, SearchIcon, TrashIcon, UserPlusIcon } from '../icons';

const PER_PAGE = 20;

export default function Members() {
	// Columns added by extensions via the `teamgraph.memberColumns` filter.
	// Spec: { key, label, render?( member ) } — without render, member[ key ]
	// is shown. The key must exist on the member record (teamgraph_member_fields).
	const extensionColumns = useMemo( () => applyFilters( 'teamgraph.memberColumns', [] ), [] );
	const columnCount = 8 + extensionColumns.length;
	const [ search, setSearch ] = useState( '' );
	const [ tab, setTab ] = useState( 'all' );
	const [ orderby, setOrderby ] = useState( 'title' );
	const [ order, setOrder ] = useState( 'ASC' );
	const [ page, setPage ] = useState( 1 );
	const [ result, setResult ] = useState( { items: [], total: 0, pages: 0 } );
	const [ members, setMembers ] = useState( [] ); // Flat list for manager names.
	const [ loading, setLoading ] = useState( true );
	const [ deleting, setDeleting ] = useState( null ); // Member[] awaiting trash.
	const [ purging, setPurging ] = useState( null ); // Member[] awaiting permanent delete.
	const [ emptyingTrash, setEmptyingTrash ] = useState( false );
	const [ selected, setSelected ] = useState( () => new Set() );
	const [ seeding, setSeeding ] = useState( false );
	const selectAllRef = useRef( null );

	const isTrash = tab === 'trash';
	const debouncedSearch = useDebounced( search );

	const refreshMembers = () => fetchAllMembers().then( setMembers ).catch( () => {} );

	const load = useCallback( async () => {
		setLoading( true );
		try {
			const data = await api.get( '/members', {
				search: debouncedSearch,
				status: tab === 'trash' ? 'trash' : undefined,
				top_level: tab === 'top' ? 1 : undefined,
				orderby,
				order,
				page,
				per_page: PER_PAGE,
			} );
			setResult( data );
			setSelected( new Set() ); // Rows on screen just changed; drop stale selection.
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setLoading( false );
		}
	}, [ debouncedSearch, tab, orderby, order, page ] );

	useEffect( () => {
		load();
	}, [ load ] );

	useEffect( () => {
		setPage( 1 );
	}, [ debouncedSearch, tab, orderby, order ] );

	useEffect( () => {
		refreshMembers();
	}, [] );

	useEffect( () => {
		if ( selectAllRef.current ) {
			selectAllRef.current.indeterminate = selected.size > 0 && selected.size < result.items.length;
		}
	}, [ selected, result.items.length ] );

	const managerName = ( id ) => members.find( ( member ) => member.id === id )?.name || '—';

	const seedDemo = async () => {
		setSeeding( true );
		try {
			await api.post( '/demo' );
			toast.success(
				__( 'Sample organization loaded. You can remove it any time from Settings.', 'teamgraph' )
			);
			load();
			refreshMembers();
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setSeeding( false );
		}
	};

	// A brand-new install (not an empty search result) gets onboarding.
	const isEmpty = ! loading && ! result.items.length && ! debouncedSearch && tab === 'all';

	const sortBy = ( column ) => {
		if ( orderby === column ) {
			setOrder( order === 'ASC' ? 'DESC' : 'ASC' );
		} else {
			setOrderby( column );
			setOrder( 'ASC' );
		}
	};

	const toggleOne = ( id ) =>
		setSelected( ( previous ) => {
			const next = new Set( previous );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			return next;
		} );

	const toggleAll = () =>
		setSelected( ( previous ) =>
			previous.size === result.items.length ? new Set() : new Set( result.items.map( ( m ) => m.id ) )
		);

	const confirmDelete = async () => {
		const targets = deleting;
		setDeleting( null );
		try {
			if ( targets.length === 1 ) {
				await api.del( `/members/${ targets[ 0 ].id }` );
			} else {
				await api.post( '/members/bulk-delete', {
					ids: targets.map( ( member ) => member.id ),
				} );
			}
			load();
			refreshMembers();
			toast.success(
				sprintf(
					/* translators: %d: number of members moved to trash. */
					_n(
						'%d member moved to the trash.',
						'%d members moved to the trash.',
						targets.length,
						'teamgraph'
					),
					targets.length
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const restore = async ( targets ) => {
		try {
			await api.post( '/members/restore', { ids: targets.map( ( member ) => member.id ) } );
			load();
			refreshMembers();
			toast.success(
				sprintf(
					/* translators: %d: number of members restored. */
					_n( '%d member restored.', '%d members restored.', targets.length, 'teamgraph' ),
					targets.length
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const confirmPurge = async () => {
		const targets = purging;
		setPurging( null );
		try {
			await api.post( '/members/purge', { ids: targets.map( ( member ) => member.id ) } );
			load();
			toast.success(
				sprintf(
					/* translators: %d: number of members permanently deleted. */
					_n(
						'%d member permanently deleted.',
						'%d members permanently deleted.',
						targets.length,
						'teamgraph'
					),
					targets.length
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const confirmEmptyTrash = async () => {
		setEmptyingTrash( false );
		try {
			const res = await api.post( '/trash/empty' );
			load();
			toast.success(
				sprintf(
					/* translators: %d: number of members permanently deleted. */
					_n(
						'%d member permanently deleted.',
						'%d members permanently deleted.',
						res.purged,
						'teamgraph'
					),
					res.purged
				)
			);
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const sortIndicator = ( column ) =>
		orderby === column ? ( order === 'ASC' ? ' ↑' : ' ↓' ) : '';

	const selectedMembers = result.items.filter( ( member ) => selected.has( member.id ) );

	return (
		<div className="teamgraph-screen">
			<header className="teamgraph-screen-header">
				<h1>{ __( 'Team Members', 'teamgraph' ) }</h1>
				<div className="teamgraph-screen-actions">
					<ShortcodeHelp />
					<a className="teamgraph-button-primary teamgraph-button-icon" href={ pages.add }>
						<UserPlusIcon size={ 16 } />
						{ __( 'Add Member', 'teamgraph' ) }
					</a>
				</div>
			</header>

			{ isEmpty && <EmptyState addHref={ pages.add } onSeed={ seedDemo } seeding={ seeding } /> }

			{ ! isEmpty && (
			<div className="teamgraph-list-card">
			<div className="teamgraph-list-controls">
				<div className="teamgraph-tabs" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={ tab === 'all' }
						className={ tab === 'all' ? 'is-active' : '' }
						onClick={ () => setTab( 'all' ) }
					>
						{ __( 'All', 'teamgraph' ) }
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={ tab === 'top' }
						className={ tab === 'top' ? 'is-active' : '' }
						onClick={ () => setTab( 'top' ) }
					>
						{ __( 'Top-Level', 'teamgraph' ) }
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={ isTrash }
						className={ isTrash ? 'is-active' : '' }
						onClick={ () => setTab( 'trash' ) }
					>
						{ __( 'Trash', 'teamgraph' ) }
					</button>
				</div>
				<div className="teamgraph-search">
					<SearchIcon size={ 16 } />
					<input
						type="search"
						placeholder={ __( 'Search members…', 'teamgraph' ) }
						value={ search }
						onChange={ ( event ) => setSearch( event.target.value ) }
						aria-label={ __( 'Search members', 'teamgraph' ) }
					/>
				</div>
				{ isTrash && result.total > 0 && (
					<button
						type="button"
						className="teamgraph-button-secondary teamgraph-danger-link"
						onClick={ () => setEmptyingTrash( true ) }
					>
						{ __( 'Empty Trash', 'teamgraph' ) }
					</button>
				) }
			</div>

			{ selected.size > 0 && (
				<div className="teamgraph-bulk-bar">
					<span>
						{ sprintf(
							/* translators: %d: number of selected members. */
							_n( '%d selected', '%d selected', selected.size, 'teamgraph' ),
							selected.size
						) }
					</span>
					{ isTrash ? (
						<>
							<button
								type="button"
								className="teamgraph-button-secondary"
								onClick={ () => restore( selectedMembers ) }
							>
								{ __( 'Restore selected', 'teamgraph' ) }
							</button>
							<button
								type="button"
								className="teamgraph-button-secondary teamgraph-danger-link"
								onClick={ () => setPurging( selectedMembers ) }
							>
								{ __( 'Delete permanently', 'teamgraph' ) }
							</button>
						</>
					) : (
						<button
							type="button"
							className="teamgraph-button-secondary teamgraph-danger-link"
							onClick={ () => setDeleting( selectedMembers ) }
						>
							{ __( 'Delete selected', 'teamgraph' ) }
						</button>
					) }
					<button type="button" className="teamgraph-button-link" onClick={ () => setSelected( new Set() ) }>
						{ __( 'Clear selection', 'teamgraph' ) }
					</button>
				</div>
			) }

			<table className="teamgraph-table">
				<thead>
					<tr>
						<th className="teamgraph-cell-check">
							<input
								type="checkbox"
								ref={ selectAllRef }
								checked={ result.items.length > 0 && selected.size === result.items.length }
								onChange={ toggleAll }
								aria-label={ __( 'Select all members on this page', 'teamgraph' ) }
							/>
						</th>
						<th />
						<th>
							<button type="button" onClick={ () => sortBy( 'title' ) }>
								{ __( 'Name', 'teamgraph' ) }
								{ sortIndicator( 'title' ) }
							</button>
						</th>
						<th>{ __( 'Job Title', 'teamgraph' ) }</th>
						<th>{ __( 'Reports To', 'teamgraph' ) }</th>
						<th>{ __( 'Direct Reports', 'teamgraph' ) }</th>
						<th>
							<button type="button" onClick={ () => sortBy( 'order' ) }>
								{ __( 'Order', 'teamgraph' ) }
								{ sortIndicator( 'order' ) }
							</button>
						</th>
						{ extensionColumns.map( ( column ) => (
							<th key={ column.key }>{ column.label }</th>
						) ) }
						<th />
					</tr>
				</thead>
				<tbody>
					{ loading && (
						<tr>
							<td colSpan={ columnCount } className="teamgraph-table-status">
								<Spinner />
							</td>
						</tr>
					) }
					{ ! loading && ! result.items.length && (
						<tr>
							<td colSpan={ columnCount } className="teamgraph-table-status">
								{ isTrash
									? __( 'Trash is empty.', 'teamgraph' )
									: __( 'No members found.', 'teamgraph' ) }
							</td>
						</tr>
					) }
					{ ! loading &&
						result.items.map( ( member ) => (
							<tr key={ member.id } className={ selected.has( member.id ) ? 'is-selected' : '' }>
								<td className="teamgraph-cell-check">
									<input
										type="checkbox"
										checked={ selected.has( member.id ) }
										onChange={ () => toggleOne( member.id ) }
										aria-label={ sprintf(
											/* translators: %s: member name. */
											__( 'Select %s', 'teamgraph' ),
											member.name
										) }
									/>
								</td>
								<td className="teamgraph-cell-photo">
									{ member.photo_url ? (
										<img src={ member.photo_url } alt="" />
									) : (
										<span className="teamgraph-avatar-fallback">
											{ member.name.charAt( 0 ).toUpperCase() }
										</span>
									) }
								</td>
								<td className="teamgraph-cell-name">
									{ isTrash ? (
										<span>{ member.name }</span>
									) : (
										<a href={ `${ pages.add }&member=${ member.id }` }>{ member.name }</a>
									) }
								</td>
								<td>{ member.job_title || '—' }</td>
								<td>
									{ member.parent ? managerName( member.parent ) : __( 'Top level', 'teamgraph' ) }
								</td>
								<td>{ member.reports }</td>
								<td>{ member.order }</td>
								{ extensionColumns.map( ( column ) => (
									<td key={ column.key }>
										{ column.render ? column.render( member ) : member[ column.key ] || '—' }
									</td>
								) ) }
								<td className="teamgraph-cell-actions">
									{ isTrash ? (
										<>
											<button
												type="button"
												className="teamgraph-icon-button"
												aria-label={ sprintf(
													/* translators: %s: member name. */
													__( 'Restore %s', 'teamgraph' ),
													member.name
												) }
												onClick={ () => restore( [ member ] ) }
											>
												<RestoreIcon />
											</button>
											<button
												type="button"
												className="teamgraph-icon-button teamgraph-icon-danger"
												aria-label={ sprintf(
													/* translators: %s: member name. */
													__( 'Permanently delete %s', 'teamgraph' ),
													member.name
												) }
												onClick={ () => setPurging( [ member ] ) }
											>
												<TrashIcon />
											</button>
										</>
									) : (
										<>
											<a
												className="teamgraph-icon-button"
												href={ `${ pages.add }&member=${ member.id }` }
												aria-label={ sprintf(
													/* translators: %s: member name. */
													__( 'Edit %s', 'teamgraph' ),
													member.name
												) }
											>
												<PencilIcon />
											</a>
											<button
												type="button"
												className="teamgraph-icon-button teamgraph-icon-danger"
												aria-label={ sprintf(
													/* translators: %s: member name. */
													__( 'Delete %s', 'teamgraph' ),
													member.name
												) }
												onClick={ () => setDeleting( [ member ] ) }
											>
												<TrashIcon />
											</button>
										</>
									) }
								</td>
							</tr>
						) ) }
				</tbody>
			</table>

			{ result.pages > 1 && (
				<div className="teamgraph-pagination">
					<button type="button" disabled={ page <= 1 } onClick={ () => setPage( page - 1 ) }>
						{ __( '‹ Prev', 'teamgraph' ) }
					</button>
					<span>
						{ sprintf(
							/* translators: 1: current page, 2: total pages, 3: total members. */
							__( 'Page %1$d of %2$d (%3$d members)', 'teamgraph' ),
							page,
							result.pages,
							result.total
						) }
					</span>
					<button
						type="button"
						disabled={ page >= result.pages }
						onClick={ () => setPage( page + 1 ) }
					>
						{ __( 'Next ›', 'teamgraph' ) }
					</button>
				</div>
			) }
			</div>
			) }

			{ deleting && (
				<ConfirmDialog
					title={
						deleting.length === 1
							? __( 'Delete member?', 'teamgraph' )
							: sprintf(
									/* translators: %d: number of members. */
									__( 'Delete %d members?', 'teamgraph' ),
									deleting.length
							  )
					}
					message={
						deleting.length === 1
							? sprintf(
									/* translators: %s: member name. */
									__( '“%s” will be moved to the trash. You can restore it from the Trash tab.', 'teamgraph' ),
									deleting[ 0 ].name
							  ) +
							  ( deleting[ 0 ].reports > 0
									? ' ' + __( 'Their direct reports will move up one level.', 'teamgraph' )
									: '' )
							: sprintf(
									/* translators: %d: number of members. */
									__(
										'%d members will be moved to the trash. Any direct reports they have will move up one level. You can restore them from the Trash tab.',
										'teamgraph'
									),
									deleting.length
							  )
					}
					onConfirm={ confirmDelete }
					onCancel={ () => setDeleting( null ) }
				/>
			) }

			{ purging && (
				<ConfirmDialog
					title={
						purging.length === 1
							? __( 'Permanently delete member?', 'teamgraph' )
							: sprintf(
									/* translators: %d: number of members. */
									__( 'Permanently delete %d members?', 'teamgraph' ),
									purging.length
							  )
					}
					message={
						purging.length === 1
							? sprintf(
									/* translators: %s: member name. */
									__( '“%s” will be permanently deleted. This cannot be undone.', 'teamgraph' ),
									purging[ 0 ].name
							  )
							: __(
									'These members will be permanently deleted. This cannot be undone.',
									'teamgraph'
							  )
					}
					confirmLabel={ __( 'Delete permanently', 'teamgraph' ) }
					onConfirm={ confirmPurge }
					onCancel={ () => setPurging( null ) }
				/>
			) }

			{ emptyingTrash && (
				<ConfirmDialog
					title={ __( 'Empty the trash?', 'teamgraph' ) }
					message={ __(
						'Every member in the trash will be permanently deleted. This cannot be undone.',
						'teamgraph'
					) }
					confirmLabel={ __( 'Empty Trash', 'teamgraph' ) }
					onConfirm={ confirmEmptyTrash }
					onCancel={ () => setEmptyingTrash( false ) }
				/>
			) }
		</div>
	);
}
