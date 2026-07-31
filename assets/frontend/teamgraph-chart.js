/**
 * TeamGraph — front-end enhancement.
 * Dependency-free vanilla JS. The views are fully server-rendered; this
 * script only adds behavior to what is already on the page:
 *
 *  - tree & list views: collapse/expand toggles on members with reports
 *  - grid & list views: a live filter box (injected here, so no-JS visitors
 *    never see a dead control)
 *  - showtools="true": a toolbar with zoom, expand/collapse all, fullscreen,
 *    and (unless the shortcode pinned a view) a Tree/Grid/List switcher
 *  - tree view: drag anywhere on the canvas to pan
 *
 * With JavaScript off nothing is lost — the full hierarchy renders open, and
 * every control above is injected here rather than server-rendered, so no-JS
 * visitors never see a dead button.
 */
( function () {
	'use strict';

	var L10N = window.TEAMGRAPH_L10N || {};
	var uidCounter = 0;

	var ZOOM_MIN = 0.4;
	var ZOOM_MAX = 2;
	var ZOOM_STEP = 0.2;
	// Pointer travel (px) before a drag suppresses the click on release, so
	// dragging from a card doesn't follow its link.
	var DRAG_THRESHOLD = 4;

	function str( key, fallback ) {
		return L10N[ key ] || fallback;
	}

	function sprintf( template ) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var i = 0;
		return template.replace( /%(\d+\$)?s/g, function ( match, position ) {
			var index = position ? parseInt( position, 10 ) - 1 : i++;
			return String( args[ index ] );
		} );
	}

	function init( root ) {
		if ( root.dataset.teamgraphReady ) {
			return;
		}
		root.dataset.teamgraphReady = '1';

		if ( root.dataset.tools ) {
			addToolbar( root );
		}
		enhance( root );
	}

	/**
	 * Behavior tied to the rendered view. Re-runs after a view switch swaps
	 * the body, so it must not touch anything outside .teamgraph-body.
	 */
	function enhance( root ) {
		var view = root.dataset.view;
		if ( 'tree' === view || 'list' === view ) {
			addToggles( root );
		}
		if ( 'grid' === view || 'list' === view ) {
			addFilter( root, view );
		}
		if ( 'tree' === view ) {
			addPan( root );
			scrollToTop( root );
		}
		syncToolbar( root );
	}

	function body( root ) {
		return root.querySelector( '.teamgraph-body' ) || root;
	}

	/* ------------------------------------------------------------------ */
	/* Scroll positioning                                                  */
	/* ------------------------------------------------------------------ */

	/**
	 * The tree centers its root card with auto margins, so a chart wider than
	 * its container starts scrolled to the far left — showing a leaf branch
	 * instead of the top member. Nudge the horizontal scroll so the root card
	 * is centered (and thus visible) on load.
	 */
	function scrollToTop( root ) {
		var scroll = root.querySelector( '.teamgraph-scroll' );
		var rootNode = scroll && scroll.querySelector( '.teamgraph-tree > .teamgraph-node' );
		var anchor = rootNode && rootNode.querySelector( ':scope > .teamgraph-anchor' );
		if ( ! scroll || ! anchor ) {
			return;
		}
		var scrollRect = scroll.getBoundingClientRect();
		var anchorRect = anchor.getBoundingClientRect();
		var offset = ( anchorRect.left + anchorRect.width / 2 ) - ( scrollRect.left + scroll.clientWidth / 2 );
		scroll.scrollLeft += offset;
	}

	/* ------------------------------------------------------------------ */
	/* Collapse / expand                                                   */
	/* ------------------------------------------------------------------ */

	function addToggles( root ) {
		root.querySelectorAll( '.teamgraph-has-reports' ).forEach( function ( node ) {
			var reports = node.querySelector( ':scope > .teamgraph-reports' );
			var card = node.querySelector( ':scope > .teamgraph-anchor > .teamgraph-card, :scope > .teamgraph-anchor > .teamgraph-row' );
			if ( ! reports || ! card ) {
				return;
			}
			var count = reports.querySelectorAll( ':scope > .teamgraph-node' ).length;
			var name = ( card.querySelector( '.teamgraph-name' ) || {} ).textContent || '';

			if ( ! reports.id ) {
				reports.id = 'teamgraph-reports-' + ++uidCounter;
			}

			var toggle = document.createElement( 'button' );
			toggle.type = 'button';
			toggle.className = 'teamgraph-toggle';
			toggle.textContent = count;
			toggle.setAttribute( 'aria-expanded', 'true' );
			toggle.setAttribute( 'aria-controls', reports.id );
			toggle.setAttribute(
				'aria-label',
				name
					? sprintf( str( 'reportsLabel', 'Direct reports of %1$s (%2$s)' ), name.trim(), count )
					: sprintf( str( 'reportsLabelAnon', 'Direct reports (%s)' ), count )
			);
			toggle.addEventListener( 'click', function () {
				// Collapsing/expanding changes the tree's total width, so the
				// auto-margin centering re-flows and the clicked card would jump
				// sideways (and content below shifts vertically). Anchor on the
				// toggle: record where it sits in the viewport, toggle, then undo
				// the shift so it stays exactly where the user clicked.
				var scroll = node.closest( '.teamgraph-scroll' );
				var before = toggle.getBoundingClientRect();

				var collapsed = node.classList.toggle( 'teamgraph-collapsed' );
				toggle.setAttribute( 'aria-expanded', collapsed ? 'false' : 'true' );

				var after = toggle.getBoundingClientRect();
				if ( scroll ) {
					scroll.scrollLeft += after.left - before.left;
					after = toggle.getBoundingClientRect();
				}
				var dy = after.top - before.top;
				if ( dy ) {
					window.scrollBy( 0, dy );
				}
			} );

			card.appendChild( toggle );
		} );
	}

	/* ------------------------------------------------------------------ */
	/* Live filter (grid & list)                                           */
	/* ------------------------------------------------------------------ */

	function addFilter( root, view ) {
		var items = root.querySelectorAll( 'grid' === view ? '.teamgraph-grid-item' : '.teamgraph-node' );
		if ( items.length < 2 ) {
			return;
		}

		var uid = 'teamgraph-filter-' + ++uidCounter;

		var bar = document.createElement( 'div' );
		bar.className = 'teamgraph-filter';

		var label = document.createElement( 'label' );
		label.className = 'teamgraph-sr-only';
		label.htmlFor = uid;
		label.textContent = str( 'filterLabel', 'Filter team members' );

		var input = document.createElement( 'input' );
		input.type = 'search';
		input.id = uid;
		input.placeholder = str( 'filterPlaceholder', 'Filter by name, title…' );

		var count = document.createElement( 'span' );
		count.className = 'teamgraph-filter-count';
		count.setAttribute( 'aria-live', 'polite' );

		bar.appendChild( label );
		bar.appendChild( input );
		bar.appendChild( count );
		// Inside the body, so a view switch discards it with the old view.
		var host = body( root );
		host.insertBefore( bar, host.firstChild );

		input.addEventListener( 'input', function () {
			var needle = input.value.trim().toLowerCase();
			var shown = 'grid' === view ? filterGrid( root, needle ) : filterList( root, needle );
			count.textContent = needle
				? sprintf( str( 'filterCount', '%1$s of %2$s members shown' ), shown, items.length )
				: '';
		} );
	}

	function itemMatches( item, needle ) {
		var haystack = '';
		item.querySelectorAll( '.teamgraph-name, .teamgraph-title, .teamgraph-tag, .teamgraph-pill' ).forEach(
			function ( part ) {
				haystack += part.textContent.toLowerCase() + ' ';
			}
		);
		return haystack.indexOf( needle ) !== -1;
	}

	function filterGrid( root, needle ) {
		var shown = 0;
		root.querySelectorAll( '.teamgraph-grid-item' ).forEach( function ( item ) {
			var match = ! needle || itemMatches( item, needle );
			item.classList.toggle( 'teamgraph-filtered-out', ! match );
			if ( match ) {
				shown++;
			}
		} );
		return shown;
	}

	/**
	 * Hierarchical filter: a member stays visible when their own card
	 * matches or any of their reports does (ancestors are kept as context).
	 */
	function filterList( root, needle ) {
		var shown = 0;
		var visit = function ( node ) {
			var ownCard = node.querySelector( ':scope > .teamgraph-anchor' );
			var ownMatch = ! needle || ( ownCard && itemMatches( ownCard, needle ) );
			var childMatch = false;
			node.querySelectorAll( ':scope > .teamgraph-reports > .teamgraph-node' ).forEach( function ( child ) {
				if ( visit( child ) ) {
					childMatch = true;
				}
			} );
			var visible = ownMatch || childMatch;
			node.classList.toggle( 'teamgraph-filtered-out', ! visible );
			if ( ownMatch ) {
				shown++;
			}
			return visible;
		};
		root.querySelectorAll( '.teamgraph-list > .teamgraph-node' ).forEach( visit );
		return shown;
	}

	/* ------------------------------------------------------------------ */
	/* Toolbar (showtools="true")                                          */
	/* ------------------------------------------------------------------ */

	function stateOf( root ) {
		if ( ! root.teamgraphState ) {
			root.teamgraphState = { zoom: 1, allCollapsed: false, loading: false, bar: null };
		}
		return root.teamgraphState;
	}

	/* The order the view toggle cycles through. */
	var VIEW_ORDER = [ 'tree', 'grid', 'list' ];

	function viewMeta( view ) {
		if ( 'grid' === view ) {
			return { icon: 'view-grid', label: str( 'viewGrid', 'Grid' ) };
		}
		if ( 'list' === view ) {
			return { icon: 'view-list', label: str( 'viewList', 'List' ) };
		}
		return { icon: 'view-tree', label: str( 'viewTree', 'Tree' ) };
	}

	/* Inline SVG icons (20x20, stroke = currentColor so they follow the
	   button's text color, including the inverted active state). */
	var ICONS = {
		'minus': '<path d="M5 10h10"/>',
		'plus': '<path d="M10 5v10M5 10h10"/>',
		'fit': '<rect x="2.8" y="4.6" width="14.4" height="10.8" rx="1.4"/><rect x="6.6" y="8" width="6.8" height="4" rx="0.8"/>',
		'collapse-all': '<path d="M6.5 5l3.5 3 3.5-3M6.5 15l3.5-3 3.5 3"/>',
		'expand-all': '<path d="M6.5 8.5l3.5-3 3.5 3M6.5 11.5l3.5 3 3.5-3"/>',
		'fullscreen': '<path d="M4 7.5V4h3.5M12.5 4H16v3.5M16 12.5V16h-3.5M7.5 16H4v-3.5"/>',
		'exit-fullscreen': '<path d="M7.5 4v3.5H4M16 7.5h-3.5V4M12.5 16v-3.5H16M4 12.5h3.5V16"/>',
		'view-tree': '<rect x="7.6" y="3" width="4.8" height="3.4" rx="0.7"/><rect x="2.8" y="12.6" width="4.8" height="3.4" rx="0.7"/><rect x="12.4" y="12.6" width="4.8" height="3.4" rx="0.7"/><path d="M10 6.4v2.2M5.2 12.6v-2.4h9.6v2.4"/>',
		'view-grid': '<rect x="3.4" y="3.4" width="5.4" height="5.4" rx="0.9"/><rect x="11.2" y="3.4" width="5.4" height="5.4" rx="0.9"/><rect x="3.4" y="11.2" width="5.4" height="5.4" rx="0.9"/><rect x="11.2" y="11.2" width="5.4" height="5.4" rx="0.9"/>',
		'view-list': '<path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9"/><path d="M4 5.5h.01M4 10h.01M4 14.5h.01"/>'
	};

	function icon( name ) {
		return '<svg class="teamgraph-tool-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ( ICONS[ name ] || '' ) + '</svg>';
	}

	function toolButton( action, text, label ) {
		var button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'teamgraph-tool';
		button.dataset.action = action;
		button.textContent = text;
		if ( label ) {
			button.setAttribute( 'aria-label', label );
			button.title = label;
		}
		return button;
	}

	/* Icon-only tool button; the visible label lives in aria-label + title. */
	function iconButton( action, iconName, label ) {
		var button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'teamgraph-tool teamgraph-tool--icon';
		button.dataset.action = action;
		button.innerHTML = icon( iconName );
		button.setAttribute( 'aria-label', label );
		button.title = label;
		return button;
	}

	/* Swap an icon button's glyph and label (toggle states). */
	function setToolIcon( button, iconName, label ) {
		button.innerHTML = icon( iconName );
		button.setAttribute( 'aria-label', label );
		button.title = label;
	}

	function toolGroup( label ) {
		var group = document.createElement( 'div' );
		group.className = 'teamgraph-tool-group';
		if ( label ) {
			group.setAttribute( 'role', 'group' );
			group.setAttribute( 'aria-label', label );
		}
		return group;
	}

	/**
	 * Deliberately not role="toolbar": that role promises arrow-key
	 * navigation between controls, which this doesn't implement. Plain
	 * buttons in a labelled group tab normally instead.
	 */
	function addToolbar( root ) {
		var state = stateOf( root );
		var bar = document.createElement( 'div' );
		bar.className = 'teamgraph-toolbar';

		/* Zoom — tree only; hidden by syncToolbar in grid/list. Fit shows the
		   whole chart at once. */
		var zoomGroup = toolGroup( str( 'zoomReset', 'Reset zoom' ) );
		zoomGroup.className += ' teamgraph-tool-zoom';
		zoomGroup.appendChild( iconButton( 'zoom-out', 'minus', str( 'zoomOut', 'Zoom out' ) ) );
		var level = toolButton( 'zoom-reset', '100%', str( 'zoomReset', 'Reset zoom' ) );
		level.className += ' teamgraph-zoom-level';
		zoomGroup.appendChild( level );
		zoomGroup.appendChild( iconButton( 'zoom-in', 'plus', str( 'zoomIn', 'Zoom in' ) ) );
		zoomGroup.appendChild( iconButton( 'zoom-fit', 'fit', str( 'fitScreen', 'Fit the whole chart' ) ) );
		bar.appendChild( zoomGroup );

		/* Expand/collapse all + fullscreen. */
		var actions = toolGroup( '' );
		var expand = iconButton( 'expand', 'collapse-all', str( 'collapseAll', 'Collapse all' ) );
		expand.className += ' teamgraph-tool-expand';
		actions.appendChild( expand );
		actions.appendChild( iconButton( 'fullscreen', 'fullscreen', str( 'fullscreen', 'Fullscreen' ) ) );
		bar.appendChild( actions );

		/* View toggle — a single button that cycles Tree → Grid → List. Purely
		   for viewing: it re-renders client-side and never changes the saved
		   block/shortcode setting. Only shown when the author didn't pin a view. */
		if ( root.dataset.viewSwitch ) {
			var views = toolGroup( str( 'viewLabel', 'Chart view' ) );
			views.className += ' teamgraph-tool-views';
			var cycle = document.createElement( 'button' );
			cycle.type = 'button';
			cycle.className = 'teamgraph-tool teamgraph-tool--view';
			cycle.dataset.action = 'view-cycle';
			views.appendChild( cycle ); // Icon + label filled in by syncToolbar.
			bar.appendChild( views );
		}

		var status = document.createElement( 'span' );
		status.className = 'teamgraph-tool-status';
		status.setAttribute( 'role', 'status' );
		bar.appendChild( status );

		bar.addEventListener( 'click', function ( event ) {
			var button = event.target.closest( '.teamgraph-tool' );
			if ( ! button ) {
				return;
			}
			onToolClick( root, button );
		} );

		state.bar = bar;
		root.insertBefore( bar, root.firstChild );
		syncToolbar( root );
	}

	function onToolClick( root, button ) {
		var state = stateOf( root );
		switch ( button.dataset.action ) {
			case 'zoom-in':
				setZoom( root, state.zoom + ZOOM_STEP );
				break;
			case 'zoom-out':
				setZoom( root, state.zoom - ZOOM_STEP );
				break;
			case 'zoom-reset':
				setZoom( root, 1 );
				break;
			case 'zoom-fit':
				fitToScreen( root );
				break;
			case 'expand':
				setAllCollapsed( root, ! state.allCollapsed );
				break;
			case 'fullscreen':
				toggleFullscreen( root );
				break;
			case 'view':
				switchView( root, button.dataset.viewName );
				break;
			case 'view-cycle':
				cycleView( root );
				break;
		}
	}

	function cycleView( root ) {
		var idx = VIEW_ORDER.indexOf( root.dataset.view );
		switchView( root, VIEW_ORDER[ ( idx + 1 ) % VIEW_ORDER.length ] );
	}

	/** Reflect the current view/state on the toolbar's controls. */
	function syncToolbar( root ) {
		var state = stateOf( root );
		if ( ! state.bar ) {
			return;
		}
		var isTree = 'tree' === root.dataset.view;
		var hierarchical = isTree || 'list' === root.dataset.view;

		// Zoom targets the tree's transform layer; the flat views have none.
		var zoomGroup = state.bar.querySelector( '.teamgraph-tool-zoom' );
		if ( zoomGroup ) {
			zoomGroup.hidden = ! isTree;
		}
		var expand = state.bar.querySelector( '.teamgraph-tool-expand' );
		if ( expand ) {
			expand.hidden = ! hierarchical;
			if ( state.allCollapsed ) {
				setToolIcon( expand, 'expand-all', str( 'expandAll', 'Expand all' ) );
			} else {
				setToolIcon( expand, 'collapse-all', str( 'collapseAll', 'Collapse all' ) );
			}
		}
		var cycle = state.bar.querySelector( '[data-action="view-cycle"]' );
		if ( cycle ) {
			var meta = viewMeta( root.dataset.view );
			cycle.innerHTML = icon( meta.icon );
			var span = document.createElement( 'span' );
			span.className = 'teamgraph-tool-label';
			span.textContent = meta.label;
			cycle.appendChild( span );
			cycle.setAttribute(
				'aria-label',
				sprintf( str( 'viewCycle', 'Switch view, currently %s' ), meta.label )
			);
			cycle.title = str( 'viewCycleTip', 'Switch view' );
		}
	}

	/* ------------------------------------------------------------------ */
	/* Zoom                                                                */
	/* ------------------------------------------------------------------ */

	function setZoom( root, value ) {
		applyZoomValue( root, Math.min( ZOOM_MAX, Math.max( ZOOM_MIN, value ) ) );
	}

	/** Apply a clamped zoom value, keeping the current centre centred. */
	function applyZoomValue( root, value ) {
		var state = stateOf( root );
		var zoom = Math.round( value * 100 ) / 100;
		if ( zoom === state.zoom ) {
			return;
		}
		var scroll = body( root ).querySelector( '.teamgraph-scroll' );
		// Keep whatever is centred now centred after the scale change.
		var ratio = scroll && scroll.scrollWidth
			? ( scroll.scrollLeft + scroll.clientWidth / 2 ) / scroll.scrollWidth
			: 0.5;

		state.zoom = zoom;
		applyZoom( root );

		if ( scroll ) {
			scroll.scrollLeft = ratio * scroll.scrollWidth - scroll.clientWidth / 2;
		}
	}

	/**
	 * Scale the tree down (or back to 1:1) so the whole chart fits the visible
	 * area — the "show me everything" control. Fit can zoom further out than
	 * the manual buttons for a genuine overview, but never zooms past 100%.
	 */
	function fitToScreen( root ) {
		var scroll = body( root ).querySelector( '.teamgraph-scroll' );
		var layer = body( root ).querySelector( '.teamgraph-zoom' );
		if ( ! scroll || ! layer ) {
			return;
		}
		// offsetWidth/Height ignore the CSS transform, so they report the
		// tree's true unscaled size regardless of the current zoom.
		var w = layer.offsetWidth;
		var h = layer.offsetHeight;
		if ( ! w || ! h ) {
			return;
		}
		var pad = 24;
		var fit = Math.min(
			( scroll.clientWidth - pad ) / w,
			( scroll.clientHeight - pad ) / h,
			1
		);
		applyZoomValue( root, Math.max( 0.2, fit ) );
		scrollToTop( root );
	}

	function applyZoom( root ) {
		var state = stateOf( root );
		var layer = body( root ).querySelector( '.teamgraph-zoom' );
		if ( ! layer ) {
			return;
		}
		var zoom = state.zoom;
		layer.style.transform = 1 === zoom ? '' : 'scale(' + zoom + ')';
		// A transform doesn't affect layout, so the scroll container would
		// still size to the unscaled tree and clip the zoomed edges. Reserve
		// the difference as margin (negative when zoomed out).
		layer.style.marginRight = 1 === zoom ? '' : layer.offsetWidth * ( zoom - 1 ) + 'px';
		layer.style.marginBottom = 1 === zoom ? '' : layer.offsetHeight * ( zoom - 1 ) + 'px';

		var level = state.bar && state.bar.querySelector( '.teamgraph-zoom-level' );
		if ( level ) {
			level.textContent = Math.round( zoom * 100 ) + '%';
		}
	}

	/* ------------------------------------------------------------------ */
	/* Expand / collapse all                                               */
	/* ------------------------------------------------------------------ */

	function setAllCollapsed( root, collapsed ) {
		stateOf( root ).allCollapsed = collapsed;
		body( root ).querySelectorAll( '.teamgraph-has-reports' ).forEach( function ( node ) {
			node.classList.toggle( 'teamgraph-collapsed', collapsed );
			var toggle = node.querySelector( ':scope > .teamgraph-anchor .teamgraph-toggle' );
			if ( toggle ) {
				toggle.setAttribute( 'aria-expanded', collapsed ? 'false' : 'true' );
			}
		} );
		syncToolbar( root );
	}

	/* ------------------------------------------------------------------ */
	/* Fullscreen                                                          */
	/* ------------------------------------------------------------------ */

	function isFullscreen( root ) {
		return document.fullscreenElement === root || root.classList.contains( 'teamgraph-fauxscreen' );
	}

	function toggleFullscreen( root ) {
		if ( isFullscreen( root ) ) {
			if ( document.fullscreenElement === root ) {
				document.exitFullscreen();
			} else {
				setFauxscreen( root, false );
			}
			return;
		}
		// iOS Safari has no element fullscreen; fall back to a fixed overlay.
		if ( root.requestFullscreen ) {
			root.requestFullscreen().catch( function () {
				setFauxscreen( root, true );
			} );
		} else {
			setFauxscreen( root, true );
		}
	}

	function setFauxscreen( root, on ) {
		root.classList.toggle( 'teamgraph-fauxscreen', on );
		document.documentElement.classList.toggle( 'teamgraph-fauxscreen-lock', on );
		syncFullscreenButton( root );
		if ( on ) {
			scrollToTop( root );
		}
	}

	function syncFullscreenButton( root ) {
		var state = stateOf( root );
		var button = state.bar && state.bar.querySelector( '[data-action="fullscreen"]' );
		if ( ! button ) {
			return;
		}
		var active = isFullscreen( root );
		setToolIcon(
			button,
			active ? 'exit-fullscreen' : 'fullscreen',
			active ? str( 'exitFullscreen', 'Exit fullscreen' ) : str( 'fullscreen', 'Fullscreen' )
		);
		button.setAttribute( 'aria-pressed', active ? 'true' : 'false' );
	}

	document.addEventListener( 'fullscreenchange', function () {
		document.querySelectorAll( '.teamgraph' ).forEach( function ( root ) {
			syncFullscreenButton( root );
			if ( document.fullscreenElement === root ) {
				scrollToTop( root );
			}
		} );
	} );

	// The native Escape handling only applies to real fullscreen.
	document.addEventListener( 'keydown', function ( event ) {
		if ( 'Escape' !== event.key ) {
			return;
		}
		document.querySelectorAll( '.teamgraph-fauxscreen' ).forEach( function ( root ) {
			setFauxscreen( root, false );
		} );
	} );

	/* ------------------------------------------------------------------ */
	/* View switching                                                      */
	/* ------------------------------------------------------------------ */

	function switchView( root, view ) {
		var state = stateOf( root );
		var endpoint = window.TEAMGRAPH_REST;
		if ( state.loading || ! endpoint || view === root.dataset.view ) {
			return;
		}
		state.loading = true;
		root.classList.add( 'is-loading' );

		var query = [
			'view=' + encodeURIComponent( view ),
			'root=' + encodeURIComponent( root.dataset.root || '0' ),
			'department=' + encodeURIComponent( root.dataset.department || '' ),
			'location=' + encodeURIComponent( root.dataset.location || '' ),
		].join( '&' );

		var status = state.bar && state.bar.querySelector( '.teamgraph-tool-status' );
		if ( status ) {
			status.textContent = '';
		}

		window
			.fetch( endpoint + ( endpoint.indexOf( '?' ) === -1 ? '?' : '&' ) + query, {
				credentials: 'same-origin',
				// Safari caches GET fetches hard; without this a view switch can
				// re-inject a stale render (e.g. one from before a markup fix).
				cache: 'no-store',
			} )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'HTTP ' + response.status );
				}
				return response.json();
			} )
			.then( function ( data ) {
				body( root ).innerHTML = data.html;
				root.classList.remove( 'teamgraph-view-' + root.dataset.view );
				root.classList.add( 'teamgraph-view-' + data.view );
				root.dataset.view = data.view;
				// Scale is meaningless across views; start the new one at 1:1.
				state.zoom = 1;
				state.allCollapsed = false;
				enhance( root );
			} )
			.catch( function () {
				if ( status ) {
					status.textContent = str( 'loadError', 'Could not load that view.' );
				}
			} )
			.then( function () {
				state.loading = false;
				root.classList.remove( 'is-loading' );
			} );
	}

	/* ------------------------------------------------------------------ */
	/* Drag to pan (tree)                                                  */
	/* ------------------------------------------------------------------ */

	/**
	 * Grab anywhere on the canvas to scroll. Horizontal movement drives the
	 * scroll container; vertical drives whichever actually scrolls — the
	 * container in fullscreen, the window otherwise.
	 */
	function addPan( root ) {
		var scroll = body( root ).querySelector( '.teamgraph-scroll' );
		if ( ! scroll || scroll.dataset.panReady ) {
			return;
		}
		scroll.dataset.panReady = '1';

		var drag = null;

		// Photos and links are natively draggable; that ghost-drag would
		// otherwise fight the pan.
		scroll.addEventListener( 'dragstart', function ( event ) {
			if ( drag ) {
				event.preventDefault();
			}
		} );

		scroll.addEventListener( 'pointerdown', function ( event ) {
			// Touch already pans this container natively, with momentum —
			// taking it over here would only make it worse.
			if ( 'touch' === event.pointerType ) {
				return;
			}
			// Links and the collapse toggles stay pannable — a drag that
			// starts on a card shouldn't be dead — because the movement
			// threshold and the click swallow already keep plain clicks
			// working. Only text-entry controls are left alone, where
			// dragging to select is the point.
			if ( 0 !== event.button || event.target.closest( 'input, select, textarea' ) ) {
				return;
			}
			drag = {
				x: event.clientX,
				y: event.clientY,
				left: scroll.scrollLeft,
				top: scroll.scrollTop,
				moved: false,
				id: event.pointerId,
			};
			scroll.classList.add( 'is-grabbing' );
		} );

		scroll.addEventListener( 'pointermove', function ( event ) {
			if ( ! drag || event.pointerId !== drag.id ) {
				return;
			}
			var dx = event.clientX - drag.x;
			var dy = event.clientY - drag.y;
			var canScrollY = scroll.scrollHeight > scroll.clientHeight;
			// Only count the axes this container can actually pan, or a purely
			// vertical gesture on a horizontal-only chart would cross the
			// threshold, capture the pointer, and swallow the click.
			var travel = Math.abs( dx ) + ( canScrollY ? Math.abs( dy ) : 0 );
			if ( ! drag.moved && travel < DRAG_THRESHOLD ) {
				return;
			}
			if ( ! drag.moved ) {
				drag.moved = true;
				// Claim the pointer only once it's really a drag, so a plain
				// click on a card still reaches the link.
				scroll.setPointerCapture( drag.id );
			}
			event.preventDefault();
			scroll.scrollLeft = drag.left - dx;
			// Never pan the page itself: outside fullscreen this container
			// scrolls horizontally only, and moving the window turned every
			// drag into a page scroll.
			if ( canScrollY ) {
				scroll.scrollTop = drag.top - dy;
			}
		} );

		var end = function ( event ) {
			if ( ! drag || ( event && event.pointerId !== drag.id ) ) {
				return;
			}
			if ( drag.moved && scroll.hasPointerCapture && scroll.hasPointerCapture( drag.id ) ) {
				scroll.releasePointerCapture( drag.id );
			}
			// A drag that ends over a link must not activate it.
			var moved = drag.moved;
			drag = null;
			scroll.classList.remove( 'is-grabbing' );
			if ( moved ) {
				scroll.addEventListener( 'click', swallow, true );
				// Safety net: if no click follows (drag ended off-target), the
				// listener must not linger and eat the next real click.
				window.setTimeout( function () {
					scroll.removeEventListener( 'click', swallow, true );
				}, 300 );
			}
		};

		var swallow = function ( event ) {
			event.stopPropagation();
			event.preventDefault();
			scroll.removeEventListener( 'click', swallow, true );
		};

		scroll.addEventListener( 'pointerup', end );
		scroll.addEventListener( 'pointercancel', end );
	}

	/* ------------------------------------------------------------------ */

	function scan() {
		document.querySelectorAll( '.teamgraph' ).forEach( init );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', scan );
	} else {
		scan();
	}
} )();
