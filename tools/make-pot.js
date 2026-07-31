#!/usr/bin/env node
/**
 * Minimal, self-contained POT generator for TeamGraph.
 *
 * Scans PHP and JS sources for WordPress i18n calls (__/_e/_x/_n and their
 * esc_* variants) in the "teamgraph" text domain, collects any immediately
 * preceding `translators:` comments, and writes languages/teamgraph.pot.
 *
 * This is a convenience for local development. The canonical tool is
 * `wp i18n make-pot`; run that when WP-CLI is available and this file can go.
 */

const fs = require( 'fs' );
const path = require( 'path' );

const ROOT = path.resolve( __dirname, '..' );
const DOMAIN = 'teamgraph';
const OUTPUT = path.join( ROOT, 'languages', `${ DOMAIN }.pot` );

/* Files/dirs to scan. */
const INCLUDE_DIRS = [ 'includes', 'src', 'block' ];
const INCLUDE_FILES = [ 'teamgraph.php', 'uninstall.php' ];
const EXTS = new Set( [ '.php', '.js', '.jsx' ] );

/* Collect source files. */
function walk( dir, out ) {
	for ( const entry of fs.readdirSync( dir, { withFileTypes: true } ) ) {
		const full = path.join( dir, entry.name );
		if ( entry.isDirectory() ) {
			walk( full, out );
		} else if ( EXTS.has( path.extname( entry.name ) ) ) {
			out.push( full );
		}
	}
}

const files = [];
for ( const rel of INCLUDE_FILES ) {
	const full = path.join( ROOT, rel );
	if ( fs.existsSync( full ) ) {
		files.push( full );
	}
}
for ( const rel of INCLUDE_DIRS ) {
	const full = path.join( ROOT, rel );
	if ( fs.existsSync( full ) ) {
		walk( full, files );
	}
}

/*
 * Match a translation call and its opening arguments. We capture the function
 * name and then parse quoted string arguments that follow. Handles single and
 * double quoted PHP/JS strings (no interpolation — translated strings never
 * contain variables in this codebase).
 */
const FN = '(__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e|esc_html_x|_x|_n|_nx)';
const CALL_RE = new RegExp( `(?<![\\w>])${ FN }\\s*\\(`, 'g' );

/* Parse quoted-string arguments starting right after the '('. */
function parseArgs( text, startIndex ) {
	const args = [];
	let i = startIndex;
	let depth = 1;
	while ( i < text.length && depth > 0 ) {
		const ch = text[ i ];
		if ( ch === '"' || ch === "'" ) {
			const quote = ch;
			let str = '';
			i++;
			while ( i < text.length ) {
				if ( text[ i ] === '\\' ) {
					str += text[ i ] + text[ i + 1 ];
					i += 2;
					continue;
				}
				if ( text[ i ] === quote ) {
					break;
				}
				str += text[ i ];
				i++;
			}
			args.push( { raw: str, quote } );
			i++; // Past closing quote.
		} else if ( ch === '(' ) {
			depth++;
			i++;
		} else if ( ch === ')' ) {
			depth--;
			i++;
		} else if ( ch === ',' || /\s/.test( ch ) ) {
			i++;
		} else {
			// A non-string argument (variable, concatenation, number). Stop
			// collecting leading string args; we already have what we need.
			break;
		}
	}
	return args;
}

/* Normalize an escaped source string into a POT msgid literal (double-quoted). */
function toPot( rawFromSingle, quote ) {
	// rawFromSingle still contains the source escapes. First interpret them.
	let value;
	if ( quote === "'" ) {
		// PHP/JS single quote: only \\ and \' are escapes.
		value = rawFromSingle.replace( /\\(['\\])/g, '$1' );
	} else {
		value = rawFromSingle
			.replace( /\\n/g, '\n' )
			.replace( /\\t/g, '\t' )
			.replace( /\\(["\\$])/g, '$1' );
	}
	// Now escape for POT double-quoted literal.
	return value.replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ).replace( /\n/g, '\\n' );
}

const entries = new Map(); // key => { msgctxt, msgid, plural, refs:Set, comments:Set }

function addEntry( { msgctxt, msgid, plural, ref, comment } ) {
	if ( ! msgid ) {
		return;
	}
	const key = ( msgctxt || '' ) + '' + msgid + '' + ( plural || '' );
	if ( ! entries.has( key ) ) {
		entries.set( key, { msgctxt, msgid, plural, refs: new Set(), comments: new Set() } );
	}
	const e = entries.get( key );
	e.refs.add( ref );
	if ( comment ) {
		e.comments.add( comment );
	}
}

const TRANSLATOR_RE = /translators:\s*([^\n*]*)/i;

for ( const file of files ) {
	const text = fs.readFileSync( file, 'utf8' );
	const rel = path.relative( ROOT, file );
	const lines = text.split( '\n' );
	// Precompute line-start offsets for line numbers.
	const lineStarts = [ 0 ];
	for ( let i = 0; i < text.length; i++ ) {
		if ( text[ i ] === '\n' ) {
			lineStarts.push( i + 1 );
		}
	}
	const lineAt = ( offset ) => {
		let lo = 0;
		let hi = lineStarts.length - 1;
		while ( lo < hi ) {
			const mid = ( lo + hi + 1 ) >> 1;
			if ( lineStarts[ mid ] <= offset ) {
				lo = mid;
			} else {
				hi = mid - 1;
			}
		}
		return lo; // 0-based.
	};

	let m;
	CALL_RE.lastIndex = 0;
	while ( ( m = CALL_RE.exec( text ) ) !== null ) {
		const fn = m[ 1 ];
		const argStart = m.index + m[ 0 ].length;
		const args = parseArgs( text, argStart );
		if ( ! args.length ) {
			continue;
		}

		let msgctxt;
		let msgid;
		let plural;
		if ( fn === '_x' || fn === 'esc_html_x' ) {
			msgid = args[ 0 ];
			msgctxt = args[ 1 ];
		} else if ( fn === '_n' ) {
			msgid = args[ 0 ];
			plural = args[ 1 ];
		} else if ( fn === '_nx' ) {
			msgid = args[ 0 ];
			plural = args[ 1 ];
			msgctxt = args[ 3 ];
		} else {
			msgid = args[ 0 ];
		}
		if ( ! msgid ) {
			continue;
		}

		const lineNo = lineAt( m.index );
		// Look back up to 2 lines for a translators comment.
		let comment;
		for ( let l = lineNo; l >= Math.max( 0, lineNo - 3 ); l-- ) {
			const tm = TRANSLATOR_RE.exec( lines[ l ] || '' );
			if ( tm ) {
				comment = 'translators: ' + tm[ 1 ].trim().replace( /\s*\*\/\s*$/, '' ).trim();
				break;
			}
		}

		addEntry( {
			msgctxt: msgctxt ? toPot( msgctxt.raw, msgctxt.quote ) : undefined,
			msgid: toPot( msgid.raw, msgid.quote ),
			plural: plural ? toPot( plural.raw, plural.quote ) : undefined,
			ref: `${ rel }:${ lineNo + 1 }`,
			comment,
		} );
	}
}

/* block.json title/description/keywords. */
const blockJson = path.join( ROOT, 'block', 'block.json' );
if ( fs.existsSync( blockJson ) ) {
	const meta = JSON.parse( fs.readFileSync( blockJson, 'utf8' ) );
	const ref = 'block/block.json';
	const push = ( v ) =>
		v &&
		addEntry( {
			msgid: String( v ).replace( /\\/g, '\\\\' ).replace( /"/g, '\\"' ),
			ref,
		} );
	push( meta.title );
	push( meta.description );
	( meta.keywords || [] ).forEach( push );
}

/* Emit POT. */
const now = new Date().toISOString().replace( 'T', ' ' ).replace( /\..+/, '+0000' );
let out = '';
out += '# Copyright (C) 2026 23Bit Studio\n';
out += '# This file is distributed under the GPL v2 or later.\n';
out += 'msgid ""\n';
out += 'msgstr ""\n';
out += '"Project-Id-Version: TeamGraph 1.0.0\\n"\n';
out += '"Report-Msgid-Bugs-To: https://wordpress.org/support/plugin/teamgraph\\n"\n';
out += `"POT-Creation-Date: ${ now }\\n"\n`;
out += '"MIME-Version: 1.0\\n"\n';
out += '"Content-Type: text/plain; charset=UTF-8\\n"\n';
out += '"Content-Transfer-Encoding: 8bit\\n"\n';
out += '"Language-Team: LANGUAGE <LL@li.org>\\n"\n';
out += '"X-Domain: teamgraph\\n"\n';
out += '\n';

const sorted = [ ...entries.values() ].sort( ( a, b ) => {
	const ra = [ ...a.refs ][ 0 ] || '';
	const rb = [ ...b.refs ][ 0 ] || '';
	return ra.localeCompare( rb );
} );

for ( const e of sorted ) {
	for ( const c of e.comments ) {
		out += `#. ${ c }\n`;
	}
	out += `#: ${ [ ...e.refs ].join( ' ' ) }\n`;
	if ( e.msgctxt ) {
		out += `msgctxt "${ e.msgctxt }"\n`;
	}
	out += `msgid "${ e.msgid }"\n`;
	if ( e.plural ) {
		out += `msgid_plural "${ e.plural }"\n`;
		out += 'msgstr[0] ""\n';
		out += 'msgstr[1] ""\n';
	} else {
		out += 'msgstr ""\n';
	}
	out += '\n';
}

fs.writeFileSync( OUTPUT, out, 'utf8' );
console.log( `Wrote ${ path.relative( ROOT, OUTPUT ) } with ${ entries.size } entries.` );
