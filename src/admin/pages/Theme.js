/**
 * Theme screen: visual editor for color guides (up to 8 levels each, card bg /
 * optional gradient / text / pill colors) with a live card preview and WCAG
 * contrast warnings.
 */

import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { api, canSettings } from '../api';
import { CardPreview, ColorField, ConfirmDialog, Spinner } from '../components';
import { toast } from '../toast';
import { CloseIcon, TrashIcon } from '../icons';

const MAX_LEVELS = 8;

const DEFAULT_LEVEL = {
	bg: '#ffffff',
	bg2: '',
	text: '#1e2430',
	pill_bg: '#344563',
	pill_text: '#ffffff',
};

function newGroup() {
	return {
		id: `group-${ Date.now().toString( 36 ) }`,
		name: __( 'New Group', 'teamgraph' ),
		levels: [ { ...DEFAULT_LEVEL } ],
	};
}

/* ------------------------------------------------------------------ */
/* WCAG contrast checks                                                */
/* ------------------------------------------------------------------ */

function relativeLuminance( hex ) {
	let value = ( hex || '' ).replace( /^#/, '' );
	if ( /^[0-9a-f]{3}$/i.test( value ) ) {
		value = value.replace( /./g, ( c ) => c + c );
	}
	if ( ! /^[0-9a-f]{6}$/i.test( value ) ) {
		return null;
	}
	const [ r, g, b ] = [ 0, 2, 4 ].map( ( i ) => {
		const channel = parseInt( value.slice( i, i + 2 ), 16 ) / 255;
		return channel <= 0.03928 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4;
	} );
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio( a, b ) {
	const la = relativeLuminance( a );
	const lb = relativeLuminance( b );
	if ( la === null || lb === null ) {
		return null;
	}
	return ( Math.max( la, lb ) + 0.05 ) / ( Math.min( la, lb ) + 0.05 );
}

/**
 * WCAG AA issues for one color-guide level (card text vs both gradient
 * stops, pill text vs pill background). Empty array = all fine.
 */
function contrastIssues( level ) {
	const checks = [
		[ __( 'Card text', 'teamgraph' ), level.text, level.bg ],
		[ __( 'Pill text', 'teamgraph' ), level.pill_text, level.pill_bg ],
	];
	if ( level.bg2 ) {
		checks.splice( 1, 0, [ __( 'Card text on gradient end', 'teamgraph' ), level.text, level.bg2 ] );
	}
	const issues = [];
	checks.forEach( ( [ label, fg, bg ] ) => {
		const ratio = contrastRatio( fg, bg );
		if ( ratio !== null && ratio < 4.5 ) {
			issues.push(
				sprintf(
					/* translators: 1: color role (e.g. Card text), 2: contrast ratio. */
					__( '%1$s: %2$s:1 — below the WCAG AA minimum of 4.5:1.', 'teamgraph' ),
					label,
					ratio.toFixed( 1 )
				)
			);
		}
	} );
	return issues;
}

export default function Theme() {
	const [ groups, setGroups ] = useState( [] );
	const [ selectedId, setSelectedId ] = useState( '' );
	const [ loading, setLoading ] = useState( true );
	const [ saving, setSaving ] = useState( false );
	const [ dirty, setDirty ] = useState( false );
	const [ deletingGroup, setDeletingGroup ] = useState( null );

	useEffect( () => {
		( async () => {
			try {
				const allGroups = await api.get( '/groups' );
				setGroups( allGroups );
				if ( allGroups.length ) {
					setSelectedId( allGroups[ 0 ].id );
				}
			} catch ( err ) {
				toast.error( err.message );
			} finally {
				setLoading( false );
			}
		} )();
	}, [] );

	const selected = groups.find( ( group ) => group.id === selectedId );

	const updateSelected = ( updater ) => {
		setDirty( true );
		setGroups( ( previous ) =>
			previous.map( ( group ) => ( group.id === selectedId ? updater( group ) : group ) )
		);
	};

	const setLevel = ( index, key, value ) =>
		updateSelected( ( group ) => ( {
			...group,
			levels: group.levels.map( ( level, i ) =>
				i === index ? { ...level, [ key ]: value } : level
			),
		} ) );

	const addGroup = () => {
		const group = newGroup();
		setGroups( ( previous ) => [ ...previous, group ] );
		setSelectedId( group.id );
		setDirty( true );
	};

	const removeGroup = () => {
		setGroups( ( previous ) => previous.filter( ( group ) => group.id !== deletingGroup.id ) );
		if ( selectedId === deletingGroup.id ) {
			setSelectedId( groups.find( ( group ) => group.id !== deletingGroup.id )?.id || '' );
		}
		setDeletingGroup( null );
		setDirty( true );
	};

	const save = async () => {
		setSaving( true );
		try {
			const saved = await api.put( '/groups', { groups } );
			setGroups( saved );
			setDirty( false );
			toast.success( __( 'Color guides saved.', 'teamgraph' ) );
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

	return (
		<div className="teamgraph-screen">
			<header className="teamgraph-screen-header">
				<h1>{ __( 'Theme', 'teamgraph' ) }</h1>
				{ canSettings && (
					<button
						type="button"
						className="teamgraph-button-primary"
						disabled={ ! dirty || saving }
						onClick={ save }
					>
						{ saving
							? __( 'Saving…', 'teamgraph' )
							: dirty
							? __( 'Save Changes', 'teamgraph' )
							: __( 'Saved', 'teamgraph' ) }
					</button>
				) }
			</header>

			<div className="teamgraph-groups-layout">
				<aside className="teamgraph-groups-sidebar">
					<h2>{ __( 'Color Guides', 'teamgraph' ) }</h2>
					<ul>
						{ groups.map( ( group ) => (
							<li key={ group.id } className={ group.id === selectedId ? 'is-active' : '' }>
								<button
									type="button"
									className="teamgraph-guide-select"
									onClick={ () => setSelectedId( group.id ) }
								>
									<span
										className="teamgraph-guide-dot"
										style={ { background: group.levels[ 0 ]?.bg || '#fff' } }
									/>
									<span className="teamgraph-guide-name">{ group.name }</span>
								</button>
								<button
									type="button"
									className="teamgraph-icon-button teamgraph-icon-danger"
									aria-label={ sprintf(
										/* translators: %s: color guide name. */
										__( 'Delete color guide “%s”', 'teamgraph' ),
										group.name
									) }
									onClick={ () => setDeletingGroup( group ) }
								>
									<TrashIcon />
								</button>
							</li>
						) ) }
					</ul>
					<button type="button" className="teamgraph-button-secondary" onClick={ addGroup }>
						{ __( '+ New Group', 'teamgraph' ) }
					</button>
				</aside>

				{ selected ? (
					<div className="teamgraph-groups-editor">
						<label className="teamgraph-field">
							<span>{ __( 'Group Name', 'teamgraph' ) }</span>
							<input
								type="text"
								value={ selected.name }
								onChange={ ( event ) =>
									updateSelected( ( group ) => ( { ...group, name: event.target.value } ) )
								}
							/>
						</label>

						{ selected.levels.map( ( level, index ) => (
							<fieldset key={ index } className="teamgraph-level">
								<legend>
									{ sprintf(
										/* translators: %d: level number. */
										__( 'Level %d', 'teamgraph' ),
										index + 1
									) }
									{ index === selected.levels.length - 1 && selected.levels.length < MAX_LEVELS
										? ' ' + __( '(deeper levels reuse this style)', 'teamgraph' )
										: '' }
								</legend>
								<div className="teamgraph-level-colors">
									<ColorField
										label={ __( 'Card', 'teamgraph' ) }
										value={ level.bg }
										onChange={ ( value ) => setLevel( index, 'bg', value ) }
									/>
									<ColorField
										label={ __( 'Gradient end', 'teamgraph' ) }
										value={ level.bg2 }
										allowEmpty
										onChange={ ( value ) => setLevel( index, 'bg2', value ) }
									/>
									<ColorField
										label={ __( 'Text', 'teamgraph' ) }
										value={ level.text }
										onChange={ ( value ) => setLevel( index, 'text', value ) }
									/>
									<ColorField
										label={ __( 'Pill', 'teamgraph' ) }
										value={ level.pill_bg }
										onChange={ ( value ) => setLevel( index, 'pill_bg', value ) }
									/>
									<ColorField
										label={ __( 'Pill text', 'teamgraph' ) }
										value={ level.pill_text }
										onChange={ ( value ) => setLevel( index, 'pill_text', value ) }
									/>
									{ selected.levels.length > 1 && (
										<button
											type="button"
											className="teamgraph-icon-button teamgraph-icon-danger teamgraph-level-remove"
											aria-label={ sprintf(
												/* translators: %d: level number. */
												__( 'Remove level %d', 'teamgraph' ),
												index + 1
											) }
											onClick={ () =>
												updateSelected( ( group ) => ( {
													...group,
													levels: group.levels.filter( ( _, i ) => i !== index ),
												} ) )
											}
										>
											<CloseIcon />
										</button>
									) }
								</div>
								{ contrastIssues( level ).map( ( issue, i ) => (
									<p key={ i } className="teamgraph-contrast-warning">
										⚠ { issue }
									</p>
								) ) }
							</fieldset>
						) ) }

						{ selected.levels.length < MAX_LEVELS && (
							<button
								type="button"
								className="teamgraph-button-secondary"
								onClick={ () =>
									updateSelected( ( group ) => ( {
										...group,
										levels: [
											...group.levels,
											{ ...group.levels[ group.levels.length - 1 ] },
										],
									} ) )
								}
							>
								{ sprintf(
									/* translators: 1: current level count, 2: maximum levels. */
									__( '+ Add Level (%1$d/%2$d)', 'teamgraph' ),
									selected.levels.length,
									MAX_LEVELS
								) }
							</button>
						) }
					</div>
				) : (
					<div className="teamgraph-groups-editor">
						<p>{ __( 'Create a color guide to get started.', 'teamgraph' ) }</p>
					</div>
				) }

				{ selected && (
					<aside className="teamgraph-groups-preview">
						<h2>{ __( 'Live Preview', 'teamgraph' ) }</h2>
						{ selected.levels.map( ( level, index ) => (
							<CardPreview
								key={ index }
								name={ sprintf(
									/* translators: %d: level number. */
									__( 'Level %d', 'teamgraph' ),
									index + 1
								) }
								jobTitle={
									index === 0
										? __( 'Group starts here', 'teamgraph' )
										: sprintf(
												/* translators: %d: nesting depth. */
												__( 'Depth %d', 'teamgraph' ),
												index
										  )
								}
								style={ level }
								pills={ index === 0 ? [ __( 'Department', 'teamgraph' ) ] : [] }
							/>
						) ) }
					</aside>
				) }
			</div>

			{ deletingGroup && (
				<ConfirmDialog
					title={ __( 'Delete color guide?', 'teamgraph' ) }
					message={ sprintf(
						/* translators: %s: color guide name. */
						__(
							'Members assigned to “%s” will fall back to inherited styling. This is applied when you save.',
							'teamgraph'
						),
						deletingGroup.name
					) }
					onConfirm={ removeGroup }
					onCancel={ () => setDeletingGroup( null ) }
				/>
			) }
		</div>
	);
}
