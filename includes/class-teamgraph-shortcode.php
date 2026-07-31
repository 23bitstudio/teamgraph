<?php
/**
 * Front end: the [teamgraph] shortcode and the render path the block shares.
 *
 * Semantic-first: every view is server-rendered, accessible HTML. The tree
 * view is a nested list styled into an org chart purely with CSS; the list
 * view is the same hierarchy as an indented directory; the grid view is a
 * flat card grid. JavaScript only enhances what is already on the page
 * (collapse/expand toggles, live filtering) — with JS off, everything still
 * renders and reads correctly.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Shortcode {

	public static function init() {
		add_shortcode( 'teamgraph', array( __CLASS__, 'render' ) );
		// On init (not wp_enqueue_scripts) so the handles also exist in the
		// editor, where block.json references the "teamgraph-chart" style.
		add_action( 'init', array( __CLASS__, 'register_assets' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest_route' ) );
	}

	/**
	 * Public, read-only endpoint backing the toolbar's view switcher: it
	 * re-renders the same chart in another view. Deliberately separate from
	 * TeamGraph_Rest, whose routes are all capability-gated — this one is
	 * unauthenticated and must stay read-only. It exposes nothing the
	 * shortcode doesn't already print on the page.
	 */
	public static function register_rest_route() {
		register_rest_route(
			'teamgraph/v1',
			'/render',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => array( __CLASS__, 'rest_render' ),
				'args'                => array(
					'view'       => array(
						'type'    => 'string',
						'default' => 'tree',
					),
					'root'       => array(
						'type'    => 'integer',
						'default' => 0,
					),
					'department' => array(
						'type'    => 'string',
						'default' => '',
					),
					'location'   => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);
	}

	public static function rest_render( $request ) {
		$result = self::build_view(
			array(
				'view'       => (string) $request['view'],
				'root'       => (string) $request['root'],
				'department' => (string) $request['department'],
				'location'   => (string) $request['location'],
			)
		);

		return rest_ensure_response(
			array(
				'view' => $result['view'],
				'html' => $result['html'],
			)
		);
	}

	public static function register_assets() {
		wp_register_style(
			'teamgraph-chart',
			TEAMGRAPH_URL . 'assets/frontend/teamgraph-chart.css',
			array(),
			TEAMGRAPH_VERSION
		);
		wp_register_script(
			'teamgraph-chart',
			TEAMGRAPH_URL . 'assets/frontend/teamgraph-chart.js',
			array(), // Deliberately dependency-free.
			TEAMGRAPH_VERSION,
			true
		);

		// Strings for the enhancement script (kept dependency-free, so no
		// wp-i18n; %s placeholders are swapped client-side).
		wp_localize_script(
			'teamgraph-chart',
			'TEAMGRAPH_L10N',
			array(
				'filterLabel'       => __( 'Filter team members', 'teamgraph' ),
				'filterPlaceholder' => __( 'Filter by name, title…', 'teamgraph' ),
				/* translators: 1: members shown, 2: total members. */
				'filterCount'       => __( '%1$s of %2$s members shown', 'teamgraph' ),
				/* translators: 1: member name, 2: number of direct reports. */
				'reportsLabel'      => __( 'Direct reports of %1$s (%2$s)', 'teamgraph' ),
				/* translators: %s: number of direct reports. */
				'reportsLabelAnon'  => __( 'Direct reports (%s)', 'teamgraph' ),

				// Toolbar (showtools="true").
				'toolbarLabel'      => __( 'Chart tools', 'teamgraph' ),
				'zoomIn'            => __( 'Zoom in', 'teamgraph' ),
				'zoomOut'           => __( 'Zoom out', 'teamgraph' ),
				'zoomReset'         => __( 'Reset zoom', 'teamgraph' ),
				'fitScreen'         => __( 'Fit the whole chart', 'teamgraph' ),
				'expandAll'         => __( 'Expand all', 'teamgraph' ),
				'collapseAll'       => __( 'Collapse all', 'teamgraph' ),
				'fullscreen'        => __( 'Fullscreen', 'teamgraph' ),
				'exitFullscreen'    => __( 'Exit fullscreen', 'teamgraph' ),
				'viewLabel'         => __( 'Chart view', 'teamgraph' ),
				'viewTree'          => __( 'Tree', 'teamgraph' ),
				'viewGrid'          => __( 'Grid', 'teamgraph' ),
				'viewList'          => __( 'List', 'teamgraph' ),
				/* translators: %s: the current view name (Tree, Grid, or List). */
				'viewCycle'         => __( 'Switch view, currently %s', 'teamgraph' ),
				'viewCycleTip'      => __( 'Switch view', 'teamgraph' ),
				'loadError'         => __( 'Could not load that view.', 'teamgraph' ),
			)
		);

		// The view switcher calls the public render endpoint.
		wp_add_inline_script(
			'teamgraph-chart',
			'window.TEAMGRAPH_REST = ' . wp_json_encode( esc_url_raw( rest_url( 'teamgraph/v1/render' ) ) ) . ';',
			'before'
		);
	}

	/**
	 * [teamgraph view="tree" root="0" department="" location="" showtools="true"]
	 *
	 * view:       tree | grid | list (extensions can render other names via
	 *             the teamgraph_render_view filter).
	 * root:       member id to chart a single branch; 0 = whole organization.
	 * department: department name or slug — keeps only members whose effective
	 *             department matches; their reporting lines are preserved.
	 *             (A numeric term id also resolves; see resolve_term().)
	 * location:   location name or slug — same, on the location taxonomy.
	 * showtools:  true to add the front-end toolbar (zoom, expand all,
	 *             fullscreen, and — unless `view` is set explicitly — a
	 *             Tree/Grid/List switcher). WordPress lowercases attribute
	 *             names, so showTools="true" arrives here as `showtools`.
	 * viewswitch: overrides that inference either way. The block passes it
	 *             explicitly, since its `view` attribute always has a value
	 *             and so could never signal "no preference".
	 */
	public static function render( $atts ) {
		// Captured before shortcode_atts fills in defaults: an author who
		// pinned a view shouldn't get a switcher that overrides them.
		$supplied  = is_array( $atts ) ? array_change_key_case( $atts, CASE_LOWER ) : array();
		$view_lock = isset( $supplied['view'] );

		$atts = shortcode_atts(
			array(
				'view'       => 'tree',
				'root'       => '0',
				'department' => '',
				'location'   => '',
				'showtools'  => '',
				'viewswitch' => '',
			),
			$atts,
			'teamgraph'
		);
		$atts = apply_filters( 'teamgraph_shortcode_atts', $atts );

		wp_enqueue_style( 'teamgraph-chart' );
		wp_enqueue_script( 'teamgraph-chart' );

		$result     = self::build_view( $atts );
		$show_tools = self::is_truthy( $atts['showtools'] );

		$data = array(
			'data-view' => $result['view'],
		);
		if ( $show_tools ) {
			$data['data-tools'] = '1';
			// Round-tripped to the REST endpoint when switching views.
			$data['data-root']       = (string) (int) $atts['root'];
			$data['data-department'] = (string) $atts['department'];
			$data['data-location']   = (string) $atts['location'];
			$switch = isset( $supplied['viewswitch'] )
				? self::is_truthy( $atts['viewswitch'] )
				: ! $view_lock;
			if ( $switch ) {
				$data['data-view-switch'] = '1';
			}
		}

		$attributes = '';
		foreach ( $data as $key => $value ) {
			$attributes .= sprintf( ' %s="%s"', $key, esc_attr( $value ) );
		}

		// .teamgraph-body isolates the rendered view, so the toolbar and
		// filter bar the script injects as siblings survive a view swap.
		return sprintf(
			'<div class="teamgraph teamgraph-view-%1$s"%2$s><div class="teamgraph-body">%3$s</div></div>',
			esc_attr( $result['view'] ),
			$attributes,
			$result['html']
		);
	}

	/**
	 * Resolve filters and render one view's inner HTML. Shared by the
	 * shortcode and the REST endpoint so a view switch produces byte-for-byte
	 * the same markup the shortcode would have rendered.
	 *
	 * @return array{view:string,html:string} The view actually rendered
	 *               (an unknown name falls back to tree) and its markup.
	 */
	private static function build_view( $atts ) {
		$view = sanitize_key( $atts['view'] );
		$tree = TeamGraph_Data::build_tree( (int) $atts['root'] );

		$department = self::resolve_term( $atts['department'], TeamGraph_Data::TAXONOMY );
		if ( $department ) {
			$tree = self::prune_tree( $tree, 'dept', $department );
		}
		$location = self::resolve_term( $atts['location'], TeamGraph_Data::LOCATION );
		if ( $location ) {
			$tree = self::prune_tree( $tree, 'location', $location );
		}

		switch ( $view ) {
			case 'grid':
				$inner = self::render_grid( $tree );
				break;
			case 'list':
				$inner = self::render_hierarchy( $tree, 'list' );
				break;
			case 'tree':
				$inner = self::render_hierarchy( $tree, 'tree' );
				break;
			default:
				/**
				 * Let extensions render additional view names. Returning a
				 * non-empty string uses it as the container's inner HTML
				 * (the extension escapes its own output); empty falls back
				 * to the tree view.
				 */
				$inner = apply_filters( 'teamgraph_render_view', '', $view, $tree, $atts );
				if ( '' === $inner ) {
					$view  = 'tree';
					$inner = self::render_hierarchy( $tree, 'tree' );
				}
		}

		if ( empty( $tree ) ) {
			$inner = '<p class="teamgraph-empty">' . esc_html__( 'No team members to show.', 'teamgraph' ) . '</p>';
		}

		return array(
			'view' => $view,
			'html' => $inner,
		);
	}

	/**
	 * Shortcode booleans arrive as strings; accept the spellings authors
	 * actually type. wp_validate_boolean() misses "yes" and "on".
	 */
	private static function is_truthy( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}
		return in_array( strtolower( trim( (string) $value ) ), array( 'true', '1', 'yes', 'on' ), true );
	}

	/* ---------------------------------------------------------------------
	 * Filtering
	 * ------------------------------------------------------------------- */

	/**
	 * Resolve a department/location attribute to a term id. Users are told to
	 * pass a name or slug; a numeric term id is still accepted because the
	 * block stores terms numerically and the toolbar round-trips those ids to
	 * the render endpoint. Returns 0 when empty, -1 when unmatched (unmatched
	 * values render an empty chart rather than silently showing everyone).
	 */
	private static function resolve_term( $value, $taxonomy ) {
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return 0;
		}
		if ( is_numeric( $value ) ) {
			return (int) $value;
		}
		$term = get_term_by( 'slug', $value, $taxonomy );
		if ( ! $term ) {
			$term = get_term_by( 'name', $value, $taxonomy );
		}
		return $term ? (int) $term->term_id : -1;
	}

	/**
	 * Keep only nodes whose $field equals $term_id. Matching descendants of
	 * a non-matching node are promoted into its place, so reporting lines
	 * between kept members survive.
	 */
	private static function prune_tree( $nodes, $field, $term_id ) {
		$kept = array();
		foreach ( $nodes as $node ) {
			$children = self::prune_tree( $node['children'], $field, $term_id );
			if ( (int) $node[ $field ] === (int) $term_id ) {
				$node['children'] = $children;
				$kept[]           = $node;
			} else {
				$kept = array_merge( $kept, $children );
			}
		}
		return $kept;
	}

	/* ---------------------------------------------------------------------
	 * Views
	 * ------------------------------------------------------------------- */

	/**
	 * The org hierarchy as nested lists. The same markup serves both the
	 * tree view (CSS lays it out as an org chart with connectors) and the
	 * list view (an indented directory); only the container class differs.
	 * Color-guide styles apply in the tree view; the list stays plain text
	 * for contrast and printability.
	 */
	private static function render_hierarchy( $nodes, $view ) {
		if ( empty( $nodes ) ) {
			return '';
		}
		// .teamgraph-zoom is the transform target for the toolbar's zoom
		// controls. Inert without JS; it shrink-wraps the tree so scaling it
		// reports the right scrollable extent.
		$html  = '<div class="teamgraph-scroll">';
		$html .= '<div class="teamgraph-zoom">';
		$html .= self::hierarchy_level( $nodes, $view, true );
		$html .= '</div>';
		$html .= '</div>';
		return $html;
	}

	private static function hierarchy_level( $nodes, $view, $is_root ) {
		$class = $is_root ? ( 'tree' === $view ? 'teamgraph-tree' : 'teamgraph-list' ) : 'teamgraph-reports';
		// role="list"/"listitem" are restated explicitly: Safari drops the
		// native list semantics from VoiceOver when list-style is none, so the
		// hierarchy would otherwise not be announced as a list.
		$html  = '<ul role="list" class="' . $class . '"' . ( $is_root ? ' aria-label="' . esc_attr__( 'Team members by reporting line', 'teamgraph' ) . '"' : '' ) . '>';
		foreach ( $nodes as $node ) {
			$has_reports = ! empty( $node['children'] );
			$html       .= '<li role="listitem" class="teamgraph-node' . ( $has_reports ? ' teamgraph-has-reports' : '' ) . '">';
			$html       .= '<div class="teamgraph-anchor">';
			$html       .= self::pills_html( $node, $view );
			$html       .= 'tree' === $view ? self::card_html( $node ) : self::row_html( $node );
			$html       .= '</div>';
			if ( $has_reports ) {
				$html .= self::hierarchy_level( $node['children'], $view, false );
			}
			$html .= '</li>';
		}
		return $html . '</ul>';
	}

	/**
	 * Department pills above a card. Color-guide pill colors apply in the
	 * tree view only.
	 */
	private static function pills_html( $node, $view ) {
		if ( empty( $node['pills'] ) ) {
			return '';
		}
		$html = '<span class="teamgraph-pills">';
		foreach ( $node['pills'] as $pill ) {
			$style = '';
			if ( 'tree' === $view && ! empty( $node['style'] ) ) {
				$style = sprintf(
					' style="background:%s;color:%s"',
					esc_attr( $node['style']['pill_bg'] ),
					esc_attr( $node['style']['pill_text'] )
				);
			}
			$html .= '<span class="teamgraph-pill"' . $style . '>' . esc_html( $pill['label'] ) . '</span>';
		}
		return $html . '</span>';
	}

	/**
	 * The vertical member card used by the tree and grid views.
	 *
	 * @param array $node   Tree node.
	 * @param bool  $styled Whether color-guide styles apply (tree view only;
	 *                      grid stays neutral for readability).
	 * @param array $extra  Extra text lines shown under the title — the grid
	 *                      uses these for department/location since it has no
	 *                      hierarchy context.
	 */
	private static function card_html( $node, $styled = true, $extra = array() ) {
		$style = '';
		if ( $styled && ! empty( $node['style'] ) ) {
			$bg    = $node['style']['bg2']
				? 'linear-gradient(160deg, ' . $node['style']['bg'] . ', ' . $node['style']['bg2'] . ')'
				: $node['style']['bg'];
			$style = ' style="background:' . esc_attr( $bg ) . ';color:' . esc_attr( $node['style']['text'] ) . '"';
		}

		$html  = '<div class="teamgraph-card"' . $style . '>';
		$html .= self::photo_html( $node, 'teamgraph-photo' );
		$html .= '<div class="teamgraph-card-body">';
		$html .= self::name_html( $node, 'teamgraph-name' );

		if ( ! empty( $node['job_title'] ) ) {
			$html .= '<span class="teamgraph-title">' . esc_html( $node['job_title'] ) . '</span>';
		}

		foreach ( $extra as $line ) {
			$html .= '<span class="teamgraph-tag">' . esc_html( $line ) . '</span>';
		}

		$html .= self::contact_html( $node, 'teamgraph-contact' );
		$html .= self::meta_lines_html( $node );
		$html .= '</div></div>';
		return $html;
	}

	/**
	 * The horizontal member row used by the list view.
	 */
	private static function row_html( $node ) {
		$html  = '<div class="teamgraph-row">';
		$html .= self::photo_html( $node, 'teamgraph-row-photo' );
		$html .= '<div class="teamgraph-row-text">';
		$html .= self::name_html( $node, 'teamgraph-name' );
		if ( ! empty( $node['job_title'] ) ) {
			$html .= '<span class="teamgraph-title">' . esc_html( $node['job_title'] ) . '</span>';
		}
		$html .= self::contact_html( $node, 'teamgraph-row-contact' );
		$html .= self::meta_lines_html( $node );
		$html .= '</div></div>';
		return $html;
	}

	/**
	 * Flat card grid in hierarchy (depth-first) order, so leadership comes
	 * first without needing connectors. Department and location appear on
	 * each card since the grid carries no reporting context.
	 */
	private static function render_grid( $nodes ) {
		$members = array();
		$flatten = function ( $list ) use ( &$flatten, &$members ) {
			foreach ( $list as $node ) {
				$members[] = $node;
				$flatten( $node['children'] );
			}
		};
		$flatten( $nodes );

		if ( empty( $members ) ) {
			return '';
		}

		$departments = TeamGraph_Data::department_terms();
		$locations   = TeamGraph_Data::location_terms();

		$html = '<ul role="list" class="teamgraph-grid" aria-label="' . esc_attr__( 'Team members', 'teamgraph' ) . '">';
		foreach ( $members as $node ) {
			$extra = array();
			if ( $node['dept'] && isset( $departments[ $node['dept'] ] ) ) {
				$extra[] = $departments[ $node['dept'] ]['name'];
			}
			if ( $node['location'] && isset( $locations[ $node['location'] ] ) ) {
				$extra[] = $locations[ $node['location'] ]['name'];
			}
			$html .= '<li role="listitem" class="teamgraph-grid-item">' . self::card_html( $node, false, $extra ) . '</li>';
		}
		return $html . '</ul>';
	}

	/* ---------------------------------------------------------------------
	 * Shared fragments
	 * ------------------------------------------------------------------- */

	private static function photo_html( $node, $class ) {
		if ( ! empty( $node['photo_url'] ) ) {
			// The media library's alt text when set; otherwise empty, which
			// is correct — the photo is decorative next to the printed name.
			$alt = isset( $node['photo_alt'] ) ? $node['photo_alt'] : '';
			return '<img class="' . $class . '" src="' . esc_url( $node['photo_url'] ) . '" alt="' . esc_attr( $alt ) . '" loading="lazy" />';
		}
		$initials = '';
		foreach ( array_slice( preg_split( '/\s+/', trim( $node['name'] ) ), 0, 2 ) as $part ) {
			$initials .= mb_strtoupper( mb_substr( $part, 0, 1 ) );
		}
		return '<span class="' . $class . ' teamgraph-initials" aria-hidden="true">' . esc_html( $initials ) . '</span>';
	}

	private static function name_html( $node, $class ) {
		$name = esc_html( $node['name'] );
		if ( ! empty( $node['link_url'] ) ) {
			return '<a class="' . $class . '" href="' . esc_url( $node['link_url'] ) . '">' . $name . '</a>';
		}
		return '<span class="' . $class . '">' . $name . '</span>';
	}

	private static function contact_html( $node, $class ) {
		if ( empty( $node['email'] ) && empty( $node['phone'] ) ) {
			return '';
		}
		$html = '<span class="' . $class . '">';
		if ( ! empty( $node['email'] ) ) {
			$html .= '<a href="mailto:' . esc_attr( $node['email'] ) . '">' . esc_html( $node['email'] ) . '</a>';
		}
		if ( ! empty( $node['phone'] ) ) {
			$html .= '<a href="tel:' . esc_attr( preg_replace( '/[^+\d]/', '', $node['phone'] ) ) . '">' . esc_html( $node['phone'] ) . '</a>';
		}
		return $html . '</span>';
	}

	/**
	 * Extra lines contributed via the teamgraph_tree_node filter.
	 */
	private static function meta_lines_html( $node ) {
		if ( empty( $node['meta_lines'] ) || ! is_array( $node['meta_lines'] ) ) {
			return '';
		}
		$html = '';
		foreach ( $node['meta_lines'] as $line ) {
			$html .= '<span class="teamgraph-tag">' . esc_html( $line ) . '</span>';
		}
		return $html;
	}
}
