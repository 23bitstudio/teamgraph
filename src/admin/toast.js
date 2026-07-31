/**
 * Lightweight toast notifications for the admin screens. Dependency-free: a
 * tiny module-level pub/sub store plus a single host component. Any screen
 * calls `toast.success( … )` / `toast.error( … )`; the host (mounted once
 * next to the active page in index.js) renders them fixed to the corner, so
 * feedback appears in place instead of at the top of a scrolled page.
 */

import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const DEFAULT_DURATION = { success: 4000, info: 4000, error: 7000 };

const listeners = new Set();
let counter = 0;

function emit( type, message, options = {} ) {
	const text = ( message || '' ).toString().trim();
	if ( ! text ) {
		return 0;
	}
	const item = {
		id: ++counter,
		type,
		message: text,
		duration: options.duration ?? DEFAULT_DURATION[ type ] ?? 4000,
	};
	listeners.forEach( ( listener ) => listener( item ) );
	return item.id;
}

/**
 * Fire a toast. `error` toasts announce assertively and linger longer.
 */
export const toast = {
	success: ( message, options ) => emit( 'success', message, options ),
	error: ( message, options ) => emit( 'error', message, options ),
	info: ( message, options ) => emit( 'info', message, options ),
};

/**
 * Subscribe to new toasts. Returns an unsubscribe function.
 */
export function subscribe( listener ) {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

/**
 * Renders active toasts. Mount once per page; it listens to the shared store,
 * so any component can push a toast without prop drilling or context.
 */
export function ToastHost() {
	const [ toasts, setToasts ] = useState( [] );

	useEffect( () => {
		return subscribe( ( item ) => {
			setToasts( ( previous ) => [ ...previous, item ] );
			if ( item.duration > 0 ) {
				setTimeout( () => {
					setToasts( ( previous ) => previous.filter( ( t ) => t.id !== item.id ) );
				}, item.duration );
			}
		} );
	}, [] );

	const dismiss = ( id ) => setToasts( ( previous ) => previous.filter( ( t ) => t.id !== id ) );

	if ( ! toasts.length ) {
		return null;
	}

	return (
		<div className="teamgraph-toast-host" aria-live="polite" aria-atomic="false">
			{ toasts.map( ( item ) => (
				<div
					key={ item.id }
					className={ `teamgraph-toast is-${ item.type }` }
					role={ item.type === 'error' ? 'alert' : 'status' }
				>
					<span className="teamgraph-toast-msg">{ item.message }</span>
					<button
						type="button"
						className="teamgraph-toast-dismiss"
						aria-label={ __( 'Dismiss', 'teamgraph' ) }
						onClick={ () => dismiss( item.id ) }
					>
						×
					</button>
				</div>
			) ) }
		</div>
	);
}
