/**
 * Organization screen: management of the flat taxonomies members are grouped
 * by — departments and locations today, with room for more panels as
 * taxonomies are added.
 */

import { useEffect, useState } from '@wordpress/element';
import { __, _x, sprintf } from '@wordpress/i18n';
import { api } from '../api';
import { Spinner } from '../components';
import { toast } from '../toast';
import { PencilIcon, TrashIcon } from '../icons';

/**
 * Add / rename / delete for one flat taxonomy (departments or locations).
 * `noun` is the singular label used in success toasts.
 */
function TermManager( { title, base, placeholder, noun, terms, setTerms } ) {
	const [ draft, setDraft ] = useState( '' );

	const refresh = async () => {
		setTerms( await api.get( `/${ base }` ) );
	};

	const add = async ( event ) => {
		event.preventDefault();
		if ( ! draft.trim() ) {
			return;
		}
		try {
			await api.post( `/${ base }`, { name: draft.trim() } );
			setDraft( '' );
			await refresh();
			/* translators: %s: singular taxonomy label, e.g. Department. */
			toast.success( sprintf( __( '%s added.', 'teamgraph' ), noun ) );
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const rename = ( term ) => async () => {
		// eslint-disable-next-line no-alert
		const name = window.prompt( __( 'Rename', 'teamgraph' ), term.name );
		if ( ! name || name === term.name ) {
			return;
		}
		try {
			await api.put( `/${ base }/${ term.id }`, { name } );
			await refresh();
			/* translators: %s: singular taxonomy label, e.g. Department. */
			toast.success( sprintf( __( '%s renamed.', 'teamgraph' ), noun ) );
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	const remove = ( term ) => async () => {
		try {
			await api.del( `/${ base }/${ term.id }` );
			await refresh();
			/* translators: %s: singular taxonomy label, e.g. Department. */
			toast.success( sprintf( __( '%s deleted.', 'teamgraph' ), noun ) );
		} catch ( err ) {
			toast.error( err.message );
		}
	};

	return (
		<div className="teamgraph-departments">
			<h2>{ title }</h2>
			<ul className="teamgraph-dept-list">
				{ terms.map( ( term ) => (
					<li key={ term.id }>
						<div className="teamgraph-dept-row">
							<strong>{ term.name }</strong>
							<span className="teamgraph-dept-actions">
								<button
									type="button"
									className="teamgraph-icon-button"
									aria-label={ sprintf(
										/* translators: %s: department or location name. */
										__( 'Rename %s', 'teamgraph' ),
										term.name
									) }
									onClick={ rename( term ) }
								>
									<PencilIcon />
								</button>
								<button
									type="button"
									className="teamgraph-icon-button teamgraph-icon-danger"
									aria-label={ sprintf(
										/* translators: %s: department or location name. */
										_x(
											'Delete %s',
											'department or location',
											'teamgraph'
										),
										term.name
									) }
									onClick={ remove( term ) }
								>
									<TrashIcon />
								</button>
							</span>
						</div>
					</li>
				) ) }
			</ul>
			<form className="teamgraph-dept-add" onSubmit={ add }>
				<input
					type="text"
					placeholder={ placeholder }
					value={ draft }
					onChange={ ( event ) => setDraft( event.target.value ) }
				/>
				<button type="submit" className="teamgraph-button-secondary">
					{ __( 'Add', 'teamgraph' ) }
				</button>
			</form>
		</div>
	);
}

export default function Organization() {
	const [ departments, setDepartments ] = useState( [] );
	const [ locations, setLocations ] = useState( [] );
	const [ loading, setLoading ] = useState( true );

	useEffect( () => {
		( async () => {
			try {
				const [ allDepartments, allLocations ] = await Promise.all( [
					api.get( '/departments' ),
					api.get( '/locations' ),
				] );
				setDepartments( allDepartments );
				setLocations( allLocations );
			} catch ( err ) {
				toast.error( err.message );
			} finally {
				setLoading( false );
			}
		} )();
	}, [] );

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
				<h1>{ __( 'Organization', 'teamgraph' ) }</h1>
			</header>

			<p className="teamgraph-muted teamgraph-screen-intro">
				{ __(
					'Departments and locations are assigned to members on their profile. A department is inherited by a member’s reports until one of them sets their own; locations are individual.',
					'teamgraph'
				) }
			</p>

			<div className="teamgraph-organization-layout">
				<TermManager
					title={ __( 'Departments', 'teamgraph' ) }
					base="departments"
					placeholder={ __( 'New department…', 'teamgraph' ) }
					noun={ __( 'Department', 'teamgraph' ) }
					terms={ departments }
					setTerms={ setDepartments }
				/>

				<TermManager
					title={ __( 'Locations', 'teamgraph' ) }
					base="locations"
					placeholder={ __( 'New location…', 'teamgraph' ) }
					noun={ __( 'Location', 'teamgraph' ) }
					terms={ locations }
					setTerms={ setLocations }
				/>
			</div>
		</div>
	);
}
