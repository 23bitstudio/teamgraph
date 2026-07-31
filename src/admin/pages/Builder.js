/**
 * Chart Builder: the whole org as a nested, drag-and-drop tree with live
 * search and a slide-in drawer for adding/editing members. Drops can
 * reorder siblings (drop above/below) or reassign a manager (drop onto).
 * Cycles are blocked here AND server-side. The drawer deliberately omits
 * the bio — REST only touches post_content when the payload carries it, so
 * drawer saves leave bios intact; edit the full form for those.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api } from '../api';
import {
	CardPreview,
	ConfirmDialog,
	EmptyState,
	ManagerCombobox,
	PhotoPicker,
	Spinner,
} from '../components';
import { toast } from '../toast';
import { ChevronDownIcon, PencilIcon, SearchIcon, TrashIcon, UserPlusIcon } from '../icons';

const EMPTY_FORM = {
	name: '',
	job_title: '',
	email: '',
	phone: '',
	link_url: '',
	parent: 0,
	department: 0,
	location: 0,
	group: '',
	photo_id: 0,
	photo_url: '',
};

/* Flatten the nested tree into a lookup-friendly list. */
function flatten( nodes, out = [] ) {
	nodes.forEach( ( node ) => {
		out.push( node );
		flatten( node.children || [], out );
	} );
	return out;
}

function descendants( node, out = new Set() ) {
	out.add( node.id );
	( node.children || [] ).forEach( ( child ) => descendants( child, out ) );
	return out;
}

export default function Builder() {
	const [ data, setData ] = useState( { tree: [], departments: [], locations: [], groups: [] } );
	const [ loading, setLoading ] = useState( true );
	const [ query, setQuery ] = useState( '' );
	const [ collapsed, setCollapsed ] = useState( () => new Set() );
	const [ drawer, setDrawer ] = useState( null ); // { memberId|0, form }
	const [ deleting, setDeleting ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ seeding, setSeeding ] = useState( false );
	const dragState = useRef( null ); // { id, blocked: Set }
	const [ dropHint, setDropHint ] = useState( null ); // { id, zone }

	const load = useCallback( async () => {
		try {
			const response = await api.get( '/tree' );
			setData( response );
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setLoading( false );
		}
	}, [] );

	useEffect( () => {
		load();
	}, [ load ] );

	const flat = useMemo( () => flatten( data.tree ), [ data.tree ] );

	/* ------------------------------------------------------------------ */
	/* Search: keep matches, their ancestors, and their subtrees visible.  */
	/* ------------------------------------------------------------------ */

	const visibleIds = useMemo( () => {
		const needle = query.trim().toLowerCase();
		if ( ! needle ) {
			return null; // Everything visible.
		}
		const keep = new Set();
		const walk = ( node, ancestors ) => {
			const matches =
				node.name.toLowerCase().includes( needle ) ||
				( node.job_title || '' ).toLowerCase().includes( needle );
			if ( matches ) {
				ancestors.forEach( ( id ) => keep.add( id ) );
				descendants( node ).forEach( ( id ) => keep.add( id ) );
			}
			( node.children || [] ).forEach( ( child ) => walk( child, [ ...ancestors, node.id ] ) );
		};
		data.tree.forEach( ( node ) => walk( node, [] ) );
		return keep;
	}, [ query, data.tree ] );

	const matchIds = useMemo( () => {
		const needle = query.trim().toLowerCase();
		if ( ! needle ) {
			return new Set();
		}
		return new Set(
			flat
				.filter(
					( node ) =>
						node.name.toLowerCase().includes( needle ) ||
						( node.job_title || '' ).toLowerCase().includes( needle )
				)
				.map( ( node ) => node.id )
		);
	}, [ query, flat ] );

	/* ------------------------------------------------------------------ */
	/* Drag and drop                                                       */
	/* ------------------------------------------------------------------ */

	const onDragStart = ( node ) => ( event ) => {
		dragState.current = { id: node.id, blocked: descendants( node ) };
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData( 'text/plain', String( node.id ) );
	};

	const onDragOver = ( node ) => ( event ) => {
		const drag = dragState.current;
		if ( ! drag || drag.blocked.has( node.id ) ) {
			return; // Would create a cycle — not a valid target.
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		const rect = event.currentTarget.getBoundingClientRect();
		const y = ( event.clientY - rect.top ) / rect.height;
		setDropHint( {
			id: node.id,
			zone: y < 0.3 ? 'before' : y > 0.7 ? 'after' : 'inside',
		} );
	};

	const onDrop = ( node ) => async ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		const drag = dragState.current;
		const hint = dropHint;
		dragState.current = null;
		setDropHint( null );
		if ( ! drag || ! hint || hint.id !== node.id || drag.blocked.has( node.id ) ) {
			return;
		}

		const dragged = flat.find( ( item ) => item.id === drag.id );
		if ( ! dragged ) {
			return;
		}

		let parentId;
		let siblings;
		if ( hint.zone === 'inside' ) {
			parentId = node.id;
			siblings = ( node.children || [] ).map( ( child ) => child.id ).filter( ( id ) => id !== drag.id );
			siblings.push( drag.id );
		} else {
			parentId = node.parent || 0;
			const parentNode = flat.find( ( item ) => item.id === parentId );
			const pool = parentNode ? parentNode.children : data.tree;
			siblings = pool.map( ( child ) => child.id ).filter( ( id ) => id !== drag.id );
			const index = siblings.indexOf( node.id );
			siblings.splice( hint.zone === 'before' ? index : index + 1, 0, drag.id );
		}

		try {
			await api.post( '/reorder', { parent: parentId, ids: siblings } );
			await load();
			toast.success( __( 'Chart updated.', 'teamgraph' ) );
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const clearDrag = () => {
		dragState.current = null;
		setDropHint( null );
	};

	/* ------------------------------------------------------------------ */
	/* Drawer (add / edit)                                                 */
	/* ------------------------------------------------------------------ */

	const openAdd = ( parentId ) =>
		setDrawer( { memberId: 0, form: { ...EMPTY_FORM, parent: parentId } } );

	const openEdit = ( node ) =>
		setDrawer( {
			memberId: node.id,
			form: {
				...EMPTY_FORM,
				name: node.name,
				job_title: node.job_title,
				email: node.email,
				phone: node.phone,
				link_url: node.link_url,
				parent: node.parent || 0,
				department: node.dept_own ? node.dept : 0,
				location: node.location || 0,
				group: node.group || '',
				photo_id: node.photo_id || 0,
				photo_url: node.photo_url || '',
			},
		} );

	const setDrawerField = ( field ) => ( value ) =>
		setDrawer( ( previous ) => ( {
			...previous,
			form: { ...previous.form, [ field ]: value },
		} ) );

	const drawerInput = ( field ) => ( event ) => setDrawerField( field )( event.target.value );

	const saveDrawer = async ( event ) => {
		event.preventDefault();
		setSaving( true );
		try {
			const payload = { ...drawer.form };
			delete payload.photo_url;
			const isNew = ! drawer.memberId;
			if ( drawer.memberId ) {
				await api.put( `/members/${ drawer.memberId }`, payload );
			} else {
				await api.post( '/members', payload );
			}
			setDrawer( null );
			await load();
			toast.success(
				isNew ? __( 'Member added.', 'teamgraph' ) : __( 'Member saved.', 'teamgraph' )
			);
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setSaving( false );
		}
	};

	const confirmDelete = async () => {
		const target = deleting;
		setDeleting( null );
		try {
			await api.del( `/members/${ target.id }` );
			await load();
			toast.success( __( 'Member moved to the trash.', 'teamgraph' ) );
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const drawerExclude = useMemo( () => {
		if ( ! drawer?.memberId ) {
			return [];
		}
		const node = flat.find( ( item ) => item.id === drawer.memberId );
		return node ? [ ...descendants( node ) ] : [ drawer.memberId ];
	}, [ drawer, flat ] );

	const drawerGuide = drawer && data.groups.find( ( group ) => group.id === drawer.form.group );
	const drawerDept = drawer && data.departments.find( ( d ) => d.id === drawer.form.department );

	/* ------------------------------------------------------------------ */
	/* Rendering                                                           */
	/* ------------------------------------------------------------------ */

	const toggleCollapse = ( id ) =>
		setCollapsed( ( previous ) => {
			const next = new Set( previous );
			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}
			return next;
		} );

	const renderNode = ( node, depth ) => {
		if ( visibleIds && ! visibleIds.has( node.id ) ) {
			return null;
		}
		const hasChildren = !! ( node.children && node.children.length );
		const isCollapsed = collapsed.has( node.id ) && ! query;
		const hint = dropHint && dropHint.id === node.id ? dropHint.zone : null;

		return (
			<li key={ node.id }>
				<div
					className={ [
						'teamgraph-builder-row',
						matchIds.has( node.id ) ? 'is-match' : '',
						hint ? `is-drop-${ hint }` : '',
					]
						.filter( Boolean )
						.join( ' ' ) }
					style={ { '--depth': depth } }
					draggable
					onDragStart={ onDragStart( node ) }
					onDragOver={ onDragOver( node ) }
					onDragLeave={ () => setDropHint( ( h ) => ( h?.id === node.id ? null : h ) ) }
					onDrop={ onDrop( node ) }
					onDragEnd={ clearDrag }
				>
					{ /* Slot is always reserved so avatars stay aligned per depth. */ }
					<span className="teamgraph-builder-caret-slot">
						{ hasChildren && (
							<button
								type="button"
								className={ `teamgraph-builder-caret${ isCollapsed ? ' is-collapsed' : '' }` }
								aria-expanded={ ! isCollapsed }
								aria-label={ sprintf(
									isCollapsed
										? /* translators: %s: member name. */
										  __( 'Expand %s', 'teamgraph' )
										: /* translators: %s: member name. */
										  __( 'Collapse %s', 'teamgraph' ),
									node.name
								) }
								onClick={ () => toggleCollapse( node.id ) }
							>
								<ChevronDownIcon size={ 16 } />
							</button>
						) }
					</span>
					{ node.photo_url ? (
						<img className="teamgraph-builder-photo" src={ node.photo_url } alt="" />
					) : (
						<span className="teamgraph-builder-photo teamgraph-avatar-fallback">
							{ node.name.charAt( 0 ).toUpperCase() }
						</span>
					) }
					<span className="teamgraph-builder-name">
						<strong>{ node.name }</strong>
						{ node.job_title && <em>{ node.job_title }</em> }
					</span>
					{ node.pills.map( ( pill, index ) => (
						<span key={ index } className={ `teamgraph-mini-pill is-${ pill.type }` }>
							{ pill.label }
						</span>
					) ) }
					<span className="teamgraph-builder-actions">
						<button
							type="button"
							className="teamgraph-button-secondary teamgraph-builder-add"
							onClick={ () => openAdd( node.id ) }
						>
							{ __( '+ Add Direct Report', 'teamgraph' ) }
						</button>
						<button
							type="button"
							className="teamgraph-icon-button"
							aria-label={ sprintf(
								/* translators: %s: member name. */
								__( 'Edit %s', 'teamgraph' ),
								node.name
							) }
							onClick={ () => openEdit( node ) }
						>
							<PencilIcon />
						</button>
						<button
							type="button"
							className="teamgraph-icon-button teamgraph-icon-danger"
							aria-label={ sprintf(
								/* translators: %s: member name. */
								__( 'Delete %s', 'teamgraph' ),
								node.name
							) }
							onClick={ () => setDeleting( node ) }
						>
							<TrashIcon />
						</button>
					</span>
				</div>
				{ hasChildren && ! isCollapsed && (
					<ul className="teamgraph-builder-children">
						{ node.children.map( ( child ) => renderNode( child, depth + 1 ) ) }
					</ul>
				) }
			</li>
		);
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
				<h1>{ __( 'Chart Builder', 'teamgraph' ) }</h1>
				<button
					type="button"
					className="teamgraph-button-primary teamgraph-button-icon"
					onClick={ () => openAdd( 0 ) }
				>
					<UserPlusIcon size={ 16 } />
					{ __( 'Add Member', 'teamgraph' ) }
				</button>
			</header>

			<div className="teamgraph-list-card">
			<div className="teamgraph-list-controls">
				<div className="teamgraph-search">
					<SearchIcon size={ 16 } />
					<input
						type="search"
						placeholder={ __( 'Search the tree…', 'teamgraph' ) }
						value={ query }
						onChange={ ( event ) => setQuery( event.target.value ) }
						aria-label={ __( 'Search the tree', 'teamgraph' ) }
					/>
				</div>
				<p className="teamgraph-muted teamgraph-builder-hint">
					{ __(
						'Drag onto a member to change their manager; drag above or below to reorder siblings.',
						'teamgraph'
					) }
				</p>
			</div>

			{ ! data.tree.length && (
				<EmptyState
					onAdd={ () => openAdd( 0 ) }
					seeding={ seeding }
					onSeed={ async () => {
						setSeeding( true );
						try {
							await api.post( '/demo' );
							await load();
							toast.success( __( 'Sample organization loaded.', 'teamgraph' ) );
						} catch ( err ) {
							toast.error( err.message );
						} finally {
							setSeeding( false );
						}
					} }
				/>
			) }

			<ul className="teamgraph-builder-tree">
				{ data.tree.map( ( node ) => renderNode( node, 0 ) ) }
			</ul>
			</div>

			{ drawer && (
				<div className="teamgraph-drawer-backdrop" onClick={ () => setDrawer( null ) }>
					<div className="teamgraph-drawer" onClick={ ( event ) => event.stopPropagation() }>
						<header>
							<h2>
								{ drawer.memberId
									? sprintf(
											/* translators: %s: member name. */
											__( 'Edit: %s', 'teamgraph' ),
											drawer.form.name
									  )
									: __( 'Add Member', 'teamgraph' ) }
							</h2>
							<button
								type="button"
								onClick={ () => setDrawer( null ) }
								aria-label={ __( 'Close', 'teamgraph' ) }
							>
								×
							</button>
						</header>

						<CardPreview
							name={ drawer.form.name }
							jobTitle={ drawer.form.job_title }
							email={ drawer.form.email }
							phone={ drawer.form.phone }
							photoUrl={ drawer.form.photo_url }
							style={ drawerGuide ? drawerGuide.levels[ 0 ] : null }
							pills={ drawerDept ? [ drawerDept.name ] : [] }
						/>

						<form onSubmit={ saveDrawer }>
							<label className="teamgraph-field">
								<span>{ __( 'Name *', 'teamgraph' ) }</span>
								<input
									type="text"
									required
									value={ drawer.form.name }
									onChange={ drawerInput( 'name' ) }
								/>
							</label>
							<label className="teamgraph-field">
								<span>{ __( 'Job Title', 'teamgraph' ) }</span>
								<input
									type="text"
									value={ drawer.form.job_title }
									onChange={ drawerInput( 'job_title' ) }
								/>
							</label>
							<div className="teamgraph-field-row">
								<label className="teamgraph-field">
									<span>{ __( 'Email', 'teamgraph' ) }</span>
									<input
										type="email"
										value={ drawer.form.email }
										onChange={ drawerInput( 'email' ) }
									/>
								</label>
								<label className="teamgraph-field">
									<span>{ __( 'Phone', 'teamgraph' ) }</span>
									<input
										type="tel"
										value={ drawer.form.phone }
										onChange={ drawerInput( 'phone' ) }
									/>
								</label>
							</div>
							<label className="teamgraph-field">
								<span>{ __( 'Profile Link', 'teamgraph' ) }</span>
								<input
									type="url"
									value={ drawer.form.link_url }
									onChange={ drawerInput( 'link_url' ) }
								/>
							</label>
							<div className="teamgraph-field">
								<span>{ __( 'Reports To', 'teamgraph' ) }</span>
								<ManagerCombobox
									members={ flat }
									value={ drawer.form.parent }
									exclude={ drawerExclude }
									onChange={ setDrawerField( 'parent' ) }
								/>
							</div>
							<label className="teamgraph-field">
								<span>{ __( 'Department', 'teamgraph' ) }</span>
								<select
									value={ drawer.form.department }
									onChange={ ( event ) =>
										setDrawerField( 'department' )( Number( event.target.value ) )
									}
								>
									<option value={ 0 }>{ __( 'Inherit from manager', 'teamgraph' ) }</option>
									{ data.departments.map( ( department ) => (
										<option key={ department.id } value={ department.id }>
											{ department.name }
										</option>
									) ) }
								</select>
							</label>
							<label className="teamgraph-field">
								<span>{ __( 'Location', 'teamgraph' ) }</span>
								<select
									value={ drawer.form.location }
									onChange={ ( event ) =>
										setDrawerField( 'location' )( Number( event.target.value ) )
									}
								>
									<option value={ 0 }>{ __( 'None', 'teamgraph' ) }</option>
									{ ( data.locations || [] ).map( ( location ) => (
										<option key={ location.id } value={ location.id }>
											{ location.name }
										</option>
									) ) }
								</select>
							</label>
							<label className="teamgraph-field">
								<span>{ __( 'Styling Group', 'teamgraph' ) }</span>
								<select value={ drawer.form.group } onChange={ drawerInput( 'group' ) }>
									<option value="">{ __( 'Inherit from manager', 'teamgraph' ) }</option>
									{ data.groups.map( ( group ) => (
										<option key={ group.id } value={ group.id }>
											{ group.name }
										</option>
									) ) }
								</select>
							</label>
							<div className="teamgraph-field">
								<span>{ __( 'Photo', 'teamgraph' ) }</span>
								<PhotoPicker
									photoId={ drawer.form.photo_id }
									photoUrl={ drawer.form.photo_url }
									onChange={ ( photo ) =>
										setDrawer( ( previous ) => ( {
											...previous,
											form: {
												...previous.form,
												photo_id: photo.id,
												photo_url: photo.url,
											},
										} ) )
									}
								/>
							</div>
							<div className="teamgraph-form-actions">
								<button type="submit" className="teamgraph-button-primary" disabled={ saving }>
									{ saving ? __( 'Saving…', 'teamgraph' ) : __( 'Save', 'teamgraph' ) }
								</button>
							</div>
						</form>
					</div>
				</div>
			) }

			{ deleting && (
				<ConfirmDialog
					title={ __( 'Delete member?', 'teamgraph' ) }
					message={
						deleting.children && deleting.children.length
							? sprintf(
									/* translators: %s: member name. */
									__(
										'“%s” will be moved to the trash. Their direct reports will move up one level.',
										'teamgraph'
									),
									deleting.name
							  )
							: sprintf(
									/* translators: %s: member name. */
									__( '“%s” will be moved to the trash.', 'teamgraph' ),
									deleting.name
							  )
					}
					onConfirm={ confirmDelete }
					onCancel={ () => setDeleting( null ) }
				/>
			) }
		</div>
	);
}
