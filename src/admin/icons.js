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

/** Clipboard: copy the shortcode for pasting into a page or post. */
export function ClipboardIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M7.5 4.5h-2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-10a1 1 0 0 0-1-1h-2" />
			<rect x="7.5" y="3" width="5" height="3" rx="1" />
		</Icon>
	);
}

/** Check mark: transient confirmation after a successful copy. */
export function CheckIcon( props ) {
	return (
		<Icon strokeWidth={ 2 } { ...props }>
			<path d="M4.5 10.5l3.5 3.5 7.5-8" />
		</Icon>
	);
}

/**
 * Info "i" — the dot is a zero-length path, drawn by the shared round line
 * cap so it stays a circle at any size.
 */
export function InfoIcon( props ) {
	return (
		<Icon { ...props }>
			<circle cx="10" cy="10" r="7" />
			<path d="M10 9.2v4.3" />
			<path d="M10 6.5v.01" />
		</Icon>
	);
}

/** Angle brackets with a slash: the shortcode explainer's badge. */
export function CodeIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M7.2 6.4 3.6 10l3.6 3.6M12.8 6.4 16.4 10l-3.6 3.6M11.3 5.2 8.7 14.8" />
		</Icon>
	);
}

/** Open book: the "Learn more" row. */
export function BookIcon( props ) {
	return (
		<Icon { ...props }>
			<path d="M10 6.4C8.6 5.3 6.8 4.9 4.5 4.9v9.2c2.3 0 4.1.4 5.5 1.5 1.4-1.1 3.2-1.5 5.5-1.5V4.9c-2.3 0-4.1.4-5.5 1.5Z" />
			<path d="M10 6.4v9.2" />
		</Icon>
	);
}

export function ChevronRightIcon( props ) {
	return (
		<Icon strokeWidth={ 1.8 } { ...props }>
			<path d="M8 5.5 12.5 10 8 14.5" />
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
