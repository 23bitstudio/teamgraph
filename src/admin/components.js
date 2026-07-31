/**
 * Shared UI for the admin screens: manager combobox, media picker,
 * color popover, confirm dialog, notices, and the member card preview
 * (used by the add/edit form, builder drawer, and groups editor).
 */

import { createInterpolateElement, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { canSettings, pages } from './api';
import { toast } from './toast';
import { BookIcon, CheckIcon, ChevronRightIcon, ClipboardIcon, CodeIcon, InfoIcon } from './icons';

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
/* Shortcode copy + help                                               */
/* ------------------------------------------------------------------ */

/** Anchor on the Settings → Docs "Displaying on your site" section. */
export const DOCS_DISPLAY_ANCHOR = 'teamgraph-docs-display';

/**
 * Copy text to the clipboard, returning whether it worked.
 *
 * navigator.clipboard only exists in a secure context, which plain-http
 * wp-admin is not (local *.local dev sites especially), so fall back to a
 * throwaway textarea and execCommand rather than failing silently there.
 */
export async function copyText( text ) {
	try {
		if ( navigator.clipboard?.writeText ) {
			await navigator.clipboard.writeText( text );
			return true;
		}
	} catch ( err ) {
		// Blocked by permissions or a non-secure context — use the fallback.
	}

	const field = document.createElement( 'textarea' );
	field.value = text;
	field.setAttribute( 'readonly', '' );
	field.style.position = 'fixed';
	field.style.top = '0';
	field.style.opacity = '0';
	document.body.appendChild( field );
	field.select();

	let copied = false;
	try {
		copied = document.execCommand( 'copy' );
	} catch ( err ) {
		copied = false;
	}
	field.remove();
	return copied;
}

// Panel ids must be unique per instance for aria-controls; the component is
// rendered once per table row.
let helpInstance = 0;

const PANEL_WIDTH = 380;
const PANEL_ESTIMATED_HEIGHT = 300;
const PANEL_GAP = 8;
const CLOSE_DELAY = 260;

/**
 * Copy-shortcode button plus an "i" that reveals a short explainer on hover
 * or keyboard focus, with a deep link into the in-plugin docs.
 *
 * The panel holds a link, so it stays open for a moment after the pointer
 * leaves and while anything inside it holds focus — otherwise the link would
 * be unreachable. There is no click toggle by design.
 */
export function ShortcodeHelp( { shortcode = '[teamgraph]' } ) {
	const [ open, setOpen ] = useState( false );
	const [ coords, setCoords ] = useState( null );
	const [ copied, setCopied ] = useState( false );
	const infoRef = useRef( null );
	const panelRef = useRef( null );
	const closeTimer = useRef( null );
	const panelId = useRef( `teamgraph-shortcode-help-${ ++helpInstance }` ).current;

	const cancelClose = () => {
		if ( closeTimer.current ) {
			clearTimeout( closeTimer.current );
			closeTimer.current = null;
		}
	};

	const closeNow = () => {
		cancelClose();
		setOpen( false );
	};

	/**
	 * Close on a short delay rather than immediately. The panel sits a few
	 * pixels under the button, so while travelling between the two the pointer
	 * is briefly over neither and a plain mouseleave would snatch the panel
	 * away before the link inside it could be clicked. Re-entering either half
	 * cancels the pending close.
	 */
	const closeSoon = () => {
		cancelClose();
		closeTimer.current = setTimeout( () => {
			// Focus on the "i" or inside the panel outranks the pointer having
			// left. The copy button is excluded: clicking it focuses it, and
			// that shouldn't strand the panel open afterwards.
			const focused = document.activeElement;
			if ( focused === infoRef.current || panelRef.current?.contains( focused ) ) {
				return;
			}
			setOpen( false );
		}, CLOSE_DELAY );
	};

	/**
	 * Positioned fixed so the panel is never clipped by an ancestor's
	 * overflow. Coordinates are measured once per open and the panel closes on
	 * scroll, which keeps it anchored without a reposition loop.
	 */
	const openPanel = () => {
		cancelClose();
		const anchor = infoRef.current;
		if ( ! anchor ) {
			return;
		}
		const rect = anchor.getBoundingClientRect();
		const left = Math.max( 8, Math.min( rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8 ) );
		const spaceBelow = window.innerHeight - rect.bottom;
		const placeAbove = spaceBelow < PANEL_ESTIMATED_HEIGHT && rect.top > spaceBelow;
		setCoords( {
			left,
			...( placeAbove
				? { bottom: window.innerHeight - rect.top + PANEL_GAP }
				: { top: rect.bottom + PANEL_GAP } ),
		} );
		setOpen( true );
	};

	// Never leave a pending close behind on unmount.
	useEffect( () => cancelClose, [] );

	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}
		const onKeyDown = ( event ) => {
			if ( event.key === 'Escape' ) {
				closeNow();
				infoRef.current?.focus();
			}
		};
		document.addEventListener( 'keydown', onKeyDown );
		window.addEventListener( 'scroll', closeNow, true );
		window.addEventListener( 'resize', closeNow );
		return () => {
			document.removeEventListener( 'keydown', onKeyDown );
			window.removeEventListener( 'scroll', closeNow, true );
			window.removeEventListener( 'resize', closeNow );
		};
	}, [ open ] );

	// Drop the confirmation check mark back to the clipboard icon.
	useEffect( () => {
		if ( ! copied ) {
			return undefined;
		}
		const timer = setTimeout( () => setCopied( false ), 2000 );
		return () => clearTimeout( timer );
	}, [ copied ] );

	const onCopy = async () => {
		if ( await copyText( shortcode ) ) {
			setCopied( true );
			toast.success(
				sprintf(
					/* translators: %s: the shortcode that was copied, e.g. [teamgraph]. */
					__( 'Copied %s to the clipboard.', 'teamgraph' ),
					shortcode
				)
			);
			return;
		}
		// Show the panel so the shortcode is on screen to select by hand.
		openPanel();
		toast.error(
			__( 'Could not copy automatically. Select the shortcode and copy it.', 'teamgraph' )
		);
	};

	const docsHref =
		canSettings && pages.settings
			? `${ pages.settings }&tab=docs#${ DOCS_DISPLAY_ANCHOR }`
			: '';

	return (
		<div
			className="teamgraph-shortcode-help"
			onMouseEnter={ openPanel }
			onMouseLeave={ closeSoon }
			onBlur={ ( event ) => {
				if ( ! event.currentTarget.contains( event.relatedTarget ) ) {
					closeSoon();
				}
			} }
		>
			{ /* Hover and focus reveal the panel. Click only ever opens it —
			     never toggles it shut — so touch devices, which have no hover,
			     can still reach the copy button inside. */ }
			<button
				type="button"
				ref={ infoRef }
				className="teamgraph-icon-button teamgraph-info-button"
				aria-label={ __( 'About shortcodes', 'teamgraph' ) }
				aria-describedby={ open ? panelId : undefined }
				onFocus={ openPanel }
				onClick={ openPanel }
			>
				<InfoIcon size={ 18 } />
			</button>
			{ open && (
				<div
					className="teamgraph-shortcode-pop"
					id={ panelId }
					ref={ panelRef }
					style={ coords || undefined }
				>
					<div className="teamgraph-shortcode-pop-head">
						<span className="teamgraph-shortcode-badge" aria-hidden="true">
							<CodeIcon size={ 18 } />
						</span>
						<div>
							<strong>{ __( 'Render your org chart anywhere', 'teamgraph' ) }</strong>
							<p>
								{ __(
									'Paste this shortcode into any page or post.',
									'teamgraph'
								) }
							</p>
						</div>
					</div>

					<div className="teamgraph-shortcode-field">
						<code>{ shortcode }</code>
						<button
							type="button"
							className="teamgraph-shortcode-copy"
							aria-label={ __( 'Copy shortcode', 'teamgraph' ) }
							onClick={ onCopy }
						>
							{ copied ? <CheckIcon size={ 16 } /> : <ClipboardIcon size={ 16 } /> }
						</button>
					</div>

					<div className="teamgraph-shortcode-pop-row">
						<span className="teamgraph-shortcode-rowicon" aria-hidden="true">
							<InfoIcon size={ 18 } />
						</span>
						<div>
							<strong>{ __( 'Attributes', 'teamgraph' ) }</strong>
							<p>
								{ createInterpolateElement(
									__(
										'Change what it shows — for example <view /> to switch layout, or <dept /> to filter.',
										'teamgraph'
									),
									{
										view: <code>view=&quot;grid&quot;</code>,
										dept: <code>department=&quot;Marketing&quot;</code>,
									}
								) }
							</p>
						</div>
					</div>

					{ !! docsHref && (
						<a className="teamgraph-shortcode-more" href={ docsHref }>
							<span className="teamgraph-shortcode-rowicon" aria-hidden="true">
								<BookIcon size={ 18 } />
							</span>
							<span>
								<strong>{ __( 'Learn more', 'teamgraph' ) }</strong>
								<span>{ __( 'See all available attributes and examples.', 'teamgraph' ) }</span>
							</span>
							<ChevronRightIcon size={ 16 } />
						</a>
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
					'Add your team one member at a time, or load a small sample organization to explore the builder, color guides, and the front-end chart. Sample data can be removed at any time from the Settings screen.',
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
