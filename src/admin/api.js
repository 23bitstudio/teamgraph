/**
 * Thin fetch wrapper for the teamgraph/v1 REST namespace.
 * Rejects with an Error carrying the server's message so screens can show it.
 */

import { __, sprintf } from '@wordpress/i18n';

const config = window.TEAMGRAPH_ADMIN || {};

export const pages = config.pages || {};
export const canSettings = !! config.canSettings;

async function request( path, { method = 'GET', data, params } = {} ) {
	const url = new URL( `${ config.restUrl }${ path }`, window.location.origin );
	if ( params ) {
		Object.entries( params ).forEach( ( [ key, value ] ) => {
			if ( value !== undefined && value !== null && value !== '' ) {
				url.searchParams.set( key, value );
			}
		} );
	}

	const response = await fetch( url, {
		method,
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': config.nonce,
		},
		body: data ? JSON.stringify( data ) : undefined,
	} );

	const body = await response.json().catch( () => null );
	if ( ! response.ok ) {
		const error = new Error(
			body?.message ||
				/* translators: %d: HTTP status code. */
				sprintf( __( 'Request failed (%d)', 'teamgraph' ), response.status )
		);
		error.code = body?.code;
		error.status = response.status;
		throw error;
	}
	return body;
}

export const api = {
	get: ( path, params ) => request( path, { params } ),
	post: ( path, data ) => request( path, { method: 'POST', data } ),
	put: ( path, data ) => request( path, { method: 'PUT', data } ),
	del: ( path ) => request( path, { method: 'DELETE' } ),
};

/**
 * Every member as a flat list (walks all pages of /members).
 */
export async function fetchAllMembers() {
	const members = [];
	let page = 1;
	let pages = 1;
	do {
		const data = await api.get( '/members', { page, per_page: 100 } );
		members.push( ...data.items );
		pages = data.pages;
		page++;
	} while ( page <= pages );
	return members;
}
