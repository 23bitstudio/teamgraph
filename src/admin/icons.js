/**
 * Inline SVG icons for the admin screens. Kept as components (not an icon
 * font or sprite) so they inherit `currentColor` from the button around them
 * and ship with the bundle — no extra request, nothing to enqueue.
 *
 * All icons draw on a 20x20 viewBox and are decorative: the button that wraps
 * them carries the accessible name via aria-label.
 */

function Icon( { children, strokeWidth = 1.5, size = 15 } ) {
	return (
		<svg
			viewBox="0 0 20 20"
			width={ size }
			height={ size }
			fill="none"
			stroke="currentColor"
			strokeWidth={ strokeWidth }
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{ children }
		</svg>
	);
}

export function TrashIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10M8.5 8.5v5M11.5 8.5v5" />
		</Icon>
	);
}

export function CloseIcon( props ) {
	return (
		<Icon strokeWidth={ 1.8 } { ...props }>
			<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
		</Icon>
	);
}

export function PencilIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M13.6 3.4a1.7 1.7 0 0 1 2.4 2.4L7.3 14.5l-3.2.8.8-3.2 8.7-8.7Z" />
		</Icon>
	);
}

export function SearchIcon( props ) {
	return (
		<Icon { ...props }>
			<circle cx="9" cy="9" r="5.2" />
			<path d="M12.8 12.8 16.5 16.5" />
		</Icon>
	);
}

/** Points down when expanded; the caret button rotates it when collapsed. */
export function ChevronDownIcon( props ) {
	return (
		<Icon strokeWidth={ 1.8 } { ...props }>
			<path d="M5.5 8l4.5 4.5L14.5 8" />
		</Icon>
	);
}

export function UserPlusIcon( props ) {
	return (
		<Icon { ...props }>
			<circle cx="8" cy="6.5" r="3" />
			<path d="M2.6 16.2a5.6 5.6 0 0 1 10.8 0M15 6.2v4.4M17.2 8.4h-4.4" />
		</Icon>
	);
}

/** Counter-clockwise arrow: restore from trash. */
export function RestoreIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M4.5 8.5a6 6 0 1 1-1 4.5" />
			<path d="M4.5 4.5v4h4" />
		</Icon>
	);
}
