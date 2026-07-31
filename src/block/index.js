/**
 * TeamGraph Chart block (dynamic). Attributes and rendering live server-side
 * (block/block.json + TeamGraph_Block::render); this registers the editor UI.
 * The preview is a real server render, and since every view is semantic HTML
 * styled with CSS, what the editor shows is what the front end ships.
 */

import { registerBlockType } from '@wordpress/blocks';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import {
	ComboboxControl,
	Disabled,
	PanelBody,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import ServerSideRender from '@wordpress/server-side-render';
import metadata from '../../block/block.json';

/**
 * Flat member list for the "start from" picker (walks all pages). Users
 * without member-management capability just get the whole-organization
 * option.
 */
function useMembers() {
	const [ members, setMembers ] = useState( [] );
	useEffect( () => {
		let alive = true;
		( async () => {
			const all = [];
			let page = 1;
			let pages = 1;
			do {
				const result = await apiFetch( {
					path: `/teamgraph/v1/members?page=${ page }&per_page=100`,
				} );
				all.push( ...result.items );
				pages = result.pages;
				page++;
			} while ( page <= pages );
			if ( alive ) {
				setMembers( all );
			}
		} )().catch( () => {} );
		return () => {
			alive = false;
		};
	}, [] );
	return members;
}

/**
 * Department or location terms; empty for users without the capability
 * (they keep the "All" option).
 */
function useTerms( base ) {
	const [ terms, setTerms ] = useState( [] );
	useEffect( () => {
		let alive = true;
		apiFetch( { path: `/teamgraph/v1/${ base }` } )
			.then( ( result ) => {
				if ( alive ) {
					setTerms( result );
				}
			} )
			.catch( () => {} );
		return () => {
			alive = false;
		};
	}, [ base ] );
	return terms;
}

function termOptions( terms, allLabel ) {
	return [
		{ value: 0, label: allLabel },
		...terms.map( ( term ) => ( { value: term.id, label: term.name } ) ),
	];
}

function Edit( { attributes, setAttributes } ) {
	const { view, root, department, location, showTools, showViewSwitch } = attributes;
	const members = useMembers();
	const departments = useTerms( 'departments' );
	const locations = useTerms( 'locations' );

	// Extensions can announce additional server-rendered views (paired with
	// the PHP teamgraph_render_view filter).
	const viewOptions = applyFilters( 'teamgraph.blockViews', [
		{ value: 'tree', label: __( 'Org chart', 'teamgraph' ) },
		{ value: 'grid', label: __( 'Card grid', 'teamgraph' ) },
		{ value: 'list', label: __( 'Directory list', 'teamgraph' ) },
	] );

	return (
		<div { ...useBlockProps() }>
			<InspectorControls>
				<PanelBody title={ __( 'Chart settings', 'teamgraph' ) }>
					<SelectControl
						label={ __( 'View', 'teamgraph' ) }
						value={ view }
						options={ viewOptions }
						onChange={ ( value ) => setAttributes( { view: value } ) }
					/>
					<ComboboxControl
						label={ __( 'Start from', 'teamgraph' ) }
						value={ String( root ) }
						options={ [
							{ value: '0', label: __( 'Whole organization', 'teamgraph' ) },
							...members.map( ( member ) => ( {
								value: String( member.id ),
								label: member.job_title ? `${ member.name } — ${ member.job_title }` : member.name,
							} ) ),
						] }
						onChange={ ( value ) => setAttributes( { root: Number( value ) || 0 } ) }
						help={ __( 'Chart a single branch by picking its top member.', 'teamgraph' ) }
					/>
					<SelectControl
						label={ __( 'Department', 'teamgraph' ) }
						value={ department }
						options={ termOptions( departments, __( 'All departments', 'teamgraph' ) ) }
						onChange={ ( value ) => setAttributes( { department: Number( value ) || 0 } ) }
					/>
					<SelectControl
						label={ __( 'Location', 'teamgraph' ) }
						value={ location }
						options={ termOptions( locations, __( 'All locations', 'teamgraph' ) ) }
						onChange={ ( value ) => setAttributes( { location: Number( value ) || 0 } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Visitor tools', 'teamgraph' ) } initialOpen={ false }>
					<ToggleControl
						label={ __( 'Show toolbar', 'teamgraph' ) }
						checked={ showTools }
						onChange={ ( value ) => setAttributes( { showTools: value } ) }
						help={ __( 'Adds zoom, expand all, and fullscreen controls above the chart. Dragging to pan the org chart is always available.', 'teamgraph' ) }
					/>
					<ToggleControl
						label={ __( 'Let visitors switch views', 'teamgraph' ) }
						checked={ showViewSwitch }
						disabled={ ! showTools }
						onChange={ ( value ) => setAttributes( { showViewSwitch: value } ) }
						help={ __( 'Adds Tree / Grid / List buttons to the toolbar. Visitors can override the view chosen above.', 'teamgraph' ) }
					/>
				</PanelBody>
			</InspectorControls>
			<Disabled>
				<ServerSideRender block={ metadata.name } attributes={ attributes } />
			</Disabled>
		</div>
	);
}

registerBlockType( metadata.name, {
	edit: Edit,
	save: () => null,
} );
