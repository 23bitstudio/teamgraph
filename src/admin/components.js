/**
 * Shared UI for the admin screens: manager combobox, media picker,
 * color popover, confirm dialog, notices, and the member card preview
 * (used by the add/edit form, builder drawer, and groups editor).
 */

import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/* ------------------------------------------------------------------ */
/* Searchable manager combobox                                         */
/* ------------------------------------------------------------------ */

export function ManagerCombobox( { members, value, exclude = [], onChange, placeholder } ) {
	const emptyLabel = placeholder || __( 'No manager (top level)', 'teamgraph' );
	const [ open, setOpen ] = useState( false );
	const [ query, setQuery ] = useState( '' );
	const wrapRef = useRef( null );

	const selected = members.find( ( member ) => member.id === value );

	const options = useMemo( () => {
		const excluded = new Set( exclude );
		const needle = query.trim().toLowerCase();
		return members.filter(
			( member ) =>
				! excluded.has( member.id ) &&
				( ! needle ||
					member.name.toLowerCase().includes( needle ) ||
					( member.job_title || '' ).toLowerCase().includes( needle ) )
		);
	}, [ members, query, exclude ] );

	useEffect( () => {
		const close = ( event ) => {
			if ( wrapRef.current && ! wrapRef.current.contains( event.target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', close );
		return () => document.removeEventListener( 'mousedown', close );
	}, [] );

	return (
		<div className="teamgraph-combobox" ref={ wrapRef }>
			<button
				type="button"
				className="teamgraph-combobox-value"
				aria-haspopup="listbox"
				aria-expanded={ open }
				onClick={ () => setOpen( ! open ) }
			>
				{ selected ? (
					<span>
						<strong>{ selected.name }</strong>
						{ selected.job_title ? ` — ${ selected.job_title }` : '' }
					</span>
				) : (
					<span className="teamgraph-muted">{ emptyLabel }</span>
				) }
				<span className="teamgraph-combobox-caret">▾</span>
			</button>
			{ open && (
				<div className="teamgraph-combobox-pop">
					<input
						type="search"
						autoFocus
						placeholder={ __( 'Search members…', 'teamgraph' ) }
						value={ query }
						onChange={ ( event ) => setQuery( event.target.value ) }
					/>
					<ul role="listbox">
						<li>
							<button
								type="button"
								className={ value ? '' : 'is-selected' }
								onClick={ () => {
									onChange( 0 );
									setOpen( false );
								} }
							>
								{ emptyLabel }
							</button>
						</li>
						{ options.map( ( member ) => (
							<li key={ member.id }>
								<button
									type="button"
									className={ member.id === value ? 'is-selected' : '' }
									onClick={ () => {
										onChange( member.id );
										setOpen( false );
									} }
								>
									<strong>{ member.name }</strong>
									{ member.job_title ? (
										<span className="teamgraph-muted"> — { member.job_title }</span>
									) : null }
								</button>
							</li>
						) ) }
						{ ! options.length && (
							<li className="teamgraph-combobox-empty">{ __( 'No matches.', 'teamgraph' ) }</li>
						) }
					</ul>
				</div>
			) }
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Photo picker (WP media library)                                     */
/* ------------------------------------------------------------------ */

export function PhotoPicker( { photoId, photoUrl, name = '', onChange } ) {
	const frameRef = useRef( null );

	const openFrame = () => {
		if ( ! window.wp?.media ) {
			return;
		}
		if ( ! frameRef.current ) {
			frameRef.current = window.wp.media( {
				title: __( 'Choose a photo', 'teamgraph' ),
				button: { text: __( 'Use this photo', 'teamgraph' ) },
				library: { type: 'image' },
				multiple: false,
			} );
			frameRef.current.on( 'select', () => {
				const attachment = frameRef.current.state().get( 'selection' ).first().toJSON();
				onChange( {
					id: attachment.id,
					url: attachment.sizes?.thumbnail?.url || attachment.url,
				} );
			} );
		}
		frameRef.current.open();
	};

	return (
		<div className="teamgraph-photo-picker">
			{ photoUrl ? (
				<img src={ photoUrl } alt="" />
			) : (
				<div className="teamgraph-photo-empty" aria-hidden="true">
					{ ( name || '' ).trim().charAt( 0 ).toUpperCase() || '👤' }
				</div>
			) }
			<div className="teamgraph-photo-actions">
				<button type="button" className="teamgraph-button-secondary" onClick={ openFrame }>
					{ photoId ? __( 'Change photo', 'teamgraph' ) : __( 'Choose photo', 'teamgraph' ) }
				</button>
				{ !! photoId && (
					<button
						type="button"
						className="teamgraph-button-link"
						onClick={ () => onChange( { id: 0, url: '' } ) }
					>
						{ __( 'Remove', 'teamgraph' ) }
					</button>
				) }
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Color popover                                                       */
/* ------------------------------------------------------------------ */

export function ColorField( { label, value, allowEmpty = false, onChange } ) {
	const [ open, setOpen ] = useState( false );
	const wrapRef = useRef( null );

	useEffect( () => {
		const close = ( event ) => {
			if ( wrapRef.current && ! wrapRef.current.contains( event.target ) ) {
				setOpen( false );
			}
		};
		document.addEventListener( 'mousedown', close );
		return () => document.removeEventListener( 'mousedown', close );
	}, [] );

	return (
		<div className="teamgraph-colorfield" ref={ wrapRef }>
			<button
				type="button"
				className="teamgraph-swatch"
				title={ label }
				onClick={ () => setOpen( ! open ) }
			>
				<span
					className={ `teamgraph-swatch-chip${ value ? '' : ' is-empty' }` }
					style={ value ? { background: value } : undefined }
				/>
				<span className="teamgraph-swatch-label">{ label }</span>
			</button>
			{ open && (
				<div className="teamgraph-color-pop">
					<input
						type="color"
						value={ value || '#ffffff' }
						onChange={ ( event ) => onChange( event.target.value ) }
					/>
					<input
						type="text"
						value={ value }
						placeholder={ allowEmpty ? __( 'None', 'teamgraph' ) : '#000000' }
						onChange={ ( event ) => onChange( event.target.value ) }
					/>
					{ allowEmpty && (
						<button type="button" className="teamgraph-button-link" onClick={ () => onChange( '' ) }>
							{ __( 'Clear', 'teamgraph' ) }
						</button>
					) }
				</div>
			) }
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

export function ConfirmDialog( { title, message, confirmLabel, onConfirm, onCancel } ) {
	return (
		<div className="teamgraph-modal-backdrop" role="dialog" aria-modal="true">
			<div className="teamgraph-modal">
				<h2>{ title }</h2>
				<p>{ message }</p>
				<div className="teamgraph-modal-actions">
					<button type="button" className="teamgraph-button-secondary" onClick={ onCancel }>
						{ __( 'Cancel', 'teamgraph' ) }
					</button>
					<button type="button" className="teamgraph-button-danger" onClick={ onConfirm }>
						{ confirmLabel || __( 'Delete', 'teamgraph' ) }
					</button>
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Member card preview                                                 */
/* ------------------------------------------------------------------ */

export function CardPreview( { name, jobTitle, email, phone, photoUrl, style, pills = [] } ) {
	const cardStyle = style
		? {
				background: style.bg2
					? `linear-gradient(160deg, ${ style.bg }, ${ style.bg2 })`
					: style.bg,
				color: style.text,
		  }
		: undefined;

	const initials = ( name || '?' )
		.split( /\s+/ )
		.slice( 0, 2 )
		.map( ( part ) => part.charAt( 0 ).toUpperCase() )
		.join( '' );

	return (
		<div className="teamgraph-preview-anchor">
			{ pills.map( ( pill, index ) => (
				<span
					key={ index }
					className="teamgraph-preview-pill"
					style={ style ? { background: style.pill_bg, color: style.pill_text } : undefined }
				>
					{ pill }
				</span>
			) ) }
			<div className="teamgraph-preview-card" style={ cardStyle }>
				{ photoUrl ? (
					<img src={ photoUrl } alt="" />
				) : (
					<span className="teamgraph-preview-initials">{ initials }</span>
				) }
				<strong>{ name || __( 'New Member', 'teamgraph' ) }</strong>
				{ jobTitle && <em>{ jobTitle }</em> }
				{ ( email || phone ) && (
					<span className="teamgraph-preview-contact">
						{ email && <span>{ email }</span> }
						{ phone && <span>{ phone }</span> }
					</span>
				) }
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Spinner() {
	return <div className="teamgraph-spinner" aria-label={ __( 'Loading', 'teamgraph' ) } />;
}

/**
 * First-run panel shown when no members exist yet: add the first member, or
 * seed the sample organization (POST /demo) to explore with.
 */
export function EmptyState( { addHref, onAdd, onSeed, seeding } ) {
	return (
		<div className="teamgraph-empty">
			<h2>{ __( 'Build your first org chart', 'teamgraph' ) }</h2>
			<p>
				{ __(
					'Add your team one member at a time, or load a small sample organization to explore the builder, styling groups, and the front-end chart. Sample data can be removed at any time from the Settings screen.',
					'teamgraph'
				) }
			</p>
			<div className="teamgraph-empty-actions">
				{ addHref ? (
					<a className="teamgraph-button-primary" href={ addHref }>
						{ __( 'Add Member', 'teamgraph' ) }
					</a>
				) : (
					<button type="button" className="teamgraph-button-primary" onClick={ onAdd }>
						{ __( 'Add Member', 'teamgraph' ) }
					</button>
				) }
				<button
					type="button"
					className="teamgraph-button-secondary"
					onClick={ onSeed }
					disabled={ seeding }
				>
					{ seeding
						? __( 'Loading sample…', 'teamgraph' )
						: __( 'Load sample organization', 'teamgraph' ) }
				</button>
			</div>
		</div>
	);
}

export function useDebounced( value, delay = 250 ) {
	const [ debounced, setDebounced ] = useState( value );
	useEffect( () => {
		const timer = setTimeout( () => setDebounced( value ), delay );
		return () => clearTimeout( timer );
	}, [ value, delay ] );
	return debounced;
}
