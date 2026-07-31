/**
 * Add / Edit Member screen: form on the left, live card preview on the
 * right. Editing is the same screen with ?member=<id>.
 */

import { useEffect, useMemo, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { __, sprintf } from '@wordpress/i18n';
import { api, fetchAllMembers, pages } from '../api';
import { CardPreview, ManagerCombobox, PhotoPicker, Spinner } from '../components';
import { toast } from '../toast';

const EMPTY = {
	name: '',
	job_title: '',
	email: '',
	phone: '',
	link_url: '',
	bio: '',
	parent: 0,
	department: 0,
	location: 0,
	group: '',
	photo_id: 0,
	photo_url: '',
};

/**
 * Generic renderer for fields registered by extensions via the
 * `teamgraph.memberFormFields` filter. A spec is:
 * { key, label, type?: 'text'|'textarea'|'select'|'email'|'url'|'tel',
 *   placeholder?, options?: [{ value, label }], help?, render? }
 * `render( { value, onChange, form } )` overrides the built-in inputs.
 * The matching PHP field must be registered via `teamgraph_member_fields`
 * (same key) so the value round-trips through REST.
 */
function ExtensionField( { field, value, onChange, form } ) {
	let control;
	if ( field.render ) {
		control = field.render( { value, onChange, form } );
	} else if ( field.type === 'select' ) {
		control = (
			<select value={ value } onChange={ ( event ) => onChange( event.target.value ) }>
				{ ( field.options || [] ).map( ( option ) => (
					<option key={ option.value } value={ option.value }>
						{ option.label }
					</option>
				) ) }
			</select>
		);
	} else if ( field.type === 'textarea' ) {
		control = (
			<textarea
				rows="4"
				placeholder={ field.placeholder }
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
		);
	} else {
		control = (
			<input
				type={ field.type || 'text' }
				placeholder={ field.placeholder }
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
		);
	}
	return (
		<label className="teamgraph-field">
			<span>{ field.label }</span>
			{ control }
			{ field.help && <small className="teamgraph-muted">{ field.help }</small> }
		</label>
	);
}

export default function MemberForm() {
	const memberId = Number( new URLSearchParams( window.location.search ).get( 'member' ) ) || 0;

	// Fields added by extensions; keys must match teamgraph_member_fields (PHP).
	const extensionFields = useMemo( () => applyFilters( 'teamgraph.memberFormFields', [] ), [] );
	const emptyForm = useMemo(
		() => ( {
			...EMPTY,
			...Object.fromEntries( extensionFields.map( ( field ) => [ field.key, '' ] ) ),
		} ),
		[ extensionFields ]
	);

	const [ form, setForm ] = useState( emptyForm );
	const [ members, setMembers ] = useState( [] );
	const [ departments, setDepartments ] = useState( [] );
	const [ locations, setLocations ] = useState( [] );
	const [ groups, setGroups ] = useState( [] );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );

	useEffect( () => {
		( async () => {
			try {
				const [ allMembers, allDepartments, allLocations, allGroups, member ] = await Promise.all( [
					fetchAllMembers(),
					api.get( '/departments' ),
					api.get( '/locations' ),
					api.get( '/groups' ),
					memberId ? api.get( `/members/${ memberId }` ) : Promise.resolve( null ),
				] );
				setMembers( allMembers );
				setDepartments( allDepartments );
				setLocations( allLocations );
				setGroups( allGroups );
				if ( member ) {
					setForm( { ...emptyForm, ...member } );
				}
			} catch ( err ) {
				toast.error( err.message );
			} finally {
				setLoading( false );
			}
		} )();
	}, [ memberId ] );

	// A fresh create redirects here with ?created=1; confirm it once, then strip
	// the flag so a refresh doesn't re-announce it.
	useEffect( () => {
		const params = new URLSearchParams( window.location.search );
		if ( params.get( 'created' ) === '1' ) {
			toast.success( __( 'Member created.', 'teamgraph' ) );
			params.delete( 'created' );
			const query = params.toString();
			window.history.replaceState(
				{},
				'',
				window.location.pathname + ( query ? `?${ query }` : '' )
			);
		}
	}, [] );

	const set = ( field ) => ( value ) => {
		setForm( ( previous ) => ( { ...previous, [ field ]: value } ) );
	};
	const setFromInput = ( field ) => ( event ) => set( field )( event.target.value );

	// The member and all of their reports can't be chosen as manager.
	const excludeIds = useMemo( () => {
		if ( ! memberId ) {
			return [];
		}
		const childrenOf = new Map();
		members.forEach( ( member ) => {
			if ( ! childrenOf.has( member.parent ) ) {
				childrenOf.set( member.parent, [] );
			}
			childrenOf.get( member.parent ).push( member.id );
		} );
		const excluded = [];
		const walk = ( id ) => {
			excluded.push( id );
			( childrenOf.get( id ) || [] ).forEach( walk );
		};
		walk( memberId );
		return excluded;
	}, [ members, memberId ] );

	// Preview: resolve the effective department pill and group colors the
	// same way the chart will.
	const preview = useMemo( () => {
		const term = departments.find( ( department ) => department.id === form.department );
		const pills = term ? [ term.name ] : [];
		const guide = groups.find( ( group ) => group.id === form.group );
		return {
			pills,
			style: guide ? guide.levels[ 0 ] : null,
		};
	}, [ form.department, form.group, departments, groups ] );

	const submit = async ( event ) => {
		event.preventDefault();
		setSaving( true );
		try {
			const payload = { ...form };
			delete payload.photo_url;
			delete payload.reports;
			delete payload.order;
			const savedMember = memberId
				? await api.put( `/members/${ memberId }`, payload )
				: await api.post( '/members', payload );
			if ( ! memberId ) {
				window.location.href = `${ pages.add }&member=${ savedMember.id }&created=1`;
				return;
			}
			setForm( ( previous ) => ( { ...previous, ...savedMember } ) );
			toast.success( __( 'Saved.', 'teamgraph' ) );
		} catch ( err ) {
			toast.error( err.message );
		} finally {
			setSaving( false );
		}
	};

	if ( loading ) {
		return (
			<div className="teamgraph-screen">
				<Spinner />
			</div>
		);
	}

	const sortedDepartments = [ ...departments ].sort( ( a, b ) => a.name.localeCompare( b.name ) );
	const sortedLocations = [ ...locations ].sort( ( a, b ) => a.name.localeCompare( b.name ) );

	return (
		<div className="teamgraph-screen">
			<header className="teamgraph-screen-header">
				<h1>
					{ memberId
						? sprintf(
								/* translators: %s: member name. */
								__( 'Edit: %s', 'teamgraph' ),
								form.name
						  )
						: __( 'Add Member', 'teamgraph' ) }
				</h1>
				<a className="teamgraph-back-link" href={ pages.members }>
					<span aria-hidden="true">←</span> { __( 'All Members', 'teamgraph' ) }
				</a>
			</header>

			<div className="teamgraph-form-layout">
				<form className="teamgraph-form" onSubmit={ submit }>
					<label className="teamgraph-field">
						<span>{ __( 'Name *', 'teamgraph' ) }</span>
						<input type="text" required value={ form.name } onChange={ setFromInput( 'name' ) } />
					</label>

					<label className="teamgraph-field">
						<span>{ __( 'Job Title', 'teamgraph' ) }</span>
						<input type="text" value={ form.job_title } onChange={ setFromInput( 'job_title' ) } />
					</label>

					<div className="teamgraph-field-row">
						<label className="teamgraph-field">
							<span>{ __( 'Email', 'teamgraph' ) }</span>
							<input type="email" value={ form.email } onChange={ setFromInput( 'email' ) } />
						</label>
						<label className="teamgraph-field">
							<span>{ __( 'Phone', 'teamgraph' ) }</span>
							<input type="tel" value={ form.phone } onChange={ setFromInput( 'phone' ) } />
						</label>
					</div>

					<label className="teamgraph-field">
						<span>{ __( 'Profile Link', 'teamgraph' ) }</span>
						<input
							type="url"
							placeholder="https://…"
							value={ form.link_url }
							onChange={ setFromInput( 'link_url' ) }
						/>
					</label>

					<label className="teamgraph-field">
						<span>{ __( 'Bio', 'teamgraph' ) }</span>
						<textarea
							rows="5"
							placeholder={ __( 'A short biography…', 'teamgraph' ) }
							value={ form.bio }
							onChange={ setFromInput( 'bio' ) }
						/>
					</label>

					{ extensionFields.map( ( field ) => (
						<ExtensionField
							key={ field.key }
							field={ field }
							form={ form }
							value={ form[ field.key ] ?? '' }
							onChange={ set( field.key ) }
						/>
					) ) }

					<div className="teamgraph-field">
						<span>{ __( 'Reports To', 'teamgraph' ) }</span>
						<ManagerCombobox
							members={ members }
							value={ form.parent }
							exclude={ excludeIds }
							onChange={ set( 'parent' ) }
						/>
					</div>

					<label className="teamgraph-field">
						<span>{ __( 'Department', 'teamgraph' ) }</span>
						<select
							value={ form.department }
							onChange={ ( event ) => set( 'department' )( Number( event.target.value ) ) }
						>
							<option value={ 0 }>{ __( 'Inherit from manager', 'teamgraph' ) }</option>
							{ sortedDepartments.map( ( department ) => (
								<option key={ department.id } value={ department.id }>
									{ department.name }
								</option>
							) ) }
						</select>
					</label>

					<label className="teamgraph-field">
						<span>{ __( 'Location', 'teamgraph' ) }</span>
						<select
							value={ form.location }
							onChange={ ( event ) => set( 'location' )( Number( event.target.value ) ) }
						>
							<option value={ 0 }>{ __( 'None', 'teamgraph' ) }</option>
							{ sortedLocations.map( ( location ) => (
								<option key={ location.id } value={ location.id }>
									{ location.name }
								</option>
							) ) }
						</select>
					</label>

					<label className="teamgraph-field">
						<span>{ __( 'Color Guide', 'teamgraph' ) }</span>
						<select value={ form.group } onChange={ setFromInput( 'group' ) }>
							<option value="">{ __( 'Inherit from manager', 'teamgraph' ) }</option>
							{ groups.map( ( group ) => (
								<option key={ group.id } value={ group.id }>
									{ group.name }
								</option>
							) ) }
						</select>
					</label>

					<div className="teamgraph-field">
						<span>{ __( 'Photo', 'teamgraph' ) }</span>
						<PhotoPicker
							photoId={ form.photo_id }
							photoUrl={ form.photo_url }
							name={ form.name }
							onChange={ ( photo ) =>
								setForm( ( previous ) => ( {
									...previous,
									photo_id: photo.id,
									photo_url: photo.url,
								} ) )
							}
						/>
					</div>

					<div className="teamgraph-form-actions">
						<button type="submit" className="teamgraph-button-primary" disabled={ saving }>
							{ saving
								? __( 'Saving…', 'teamgraph' )
								: memberId
								? __( 'Save Changes', 'teamgraph' )
								: __( 'Add Member', 'teamgraph' ) }
						</button>
					</div>
				</form>

				<aside className="teamgraph-form-preview">
					<h2>{ __( 'Live Preview', 'teamgraph' ) }</h2>
					<CardPreview
						name={ form.name }
						jobTitle={ form.job_title }
						email={ form.email }
						phone={ form.phone }
						photoUrl={ form.photo_url }
						style={ preview.style }
						pills={ preview.pills }
					/>
					<p className="teamgraph-muted">
						{ __(
							'Department pills and colors shown here appear on the chart wherever this member’s branch diverges from their manager’s.',
							'teamgraph'
						) }
					</p>
				</aside>
			</div>
		</div>
	);
}
