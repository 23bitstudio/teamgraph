<?php
/**
 * Data model: member post type, the flat department and location taxonomies,
 * and the tree builder that resolves department inheritance, auto pill nodes,
 * and color-guide styling into the JSON consumed by both the Chart Builder
 * and the front end.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Data {

	const CPT      = 'teamgraph_member';
	const TAXONOMY = 'teamgraph_department';
	const LOCATION = 'teamgraph_location';

	/**
	 * Set on a report when its manager is trashed: records the trashed
	 * manager's id so restoring that manager can re-attach the branch.
	 * Cleared when the report is re-parented by hand or its manager restored.
	 */
	const PARENT_HINT_META = '_teamgraph_trashed_parent';

	/**
	 * Member meta fields, keyed by the field name used in REST payloads.
	 *
	 * Each entry: array(
	 *   'meta_key' => string,
	 *   'sanitize' => 'text'|'textarea'|'email'|'url'|'key'|callable,
	 * )
	 *
	 * Extensions add fields via the filter; they then flow
	 * through REST save and member_record() automatically. Use the
	 * teamgraph_tree_node filter to surface an added field on front-end cards.
	 */
	public static function field_map() {
		// 'meta_key' here is a config array key describing each field, not a
		// query argument, so the slow-query sniff does not apply.
		// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key
		return apply_filters(
			'teamgraph_member_fields',
			array(
				'job_title' => array( 'meta_key' => '_teamgraph_job_title', 'sanitize' => 'text' ),
				'email'     => array( 'meta_key' => '_teamgraph_email', 'sanitize' => 'email' ),
				'phone'     => array( 'meta_key' => '_teamgraph_phone', 'sanitize' => 'text' ),
				'link_url'  => array( 'meta_key' => '_teamgraph_link_url', 'sanitize' => 'url' ),
				'group'     => array( 'meta_key' => '_teamgraph_group', 'sanitize' => array( __CLASS__, 'sanitize_group' ) ),
			)
		);
		// phpcs:enable WordPress.DB.SlowDBQuery.slow_db_query_meta_key
	}

	/**
	 * Apply a field's sanitize spec (type keyword or callable) to a raw value.
	 */
	public static function sanitize_field_value( $value, $sanitize ) {
		if ( is_callable( $sanitize ) ) {
			return call_user_func( $sanitize, $value );
		}
		switch ( $sanitize ) {
			case 'email':
				return sanitize_email( $value );
			case 'url':
				return esc_url_raw( $value );
			case 'key':
				return sanitize_key( $value );
			case 'textarea':
				return sanitize_textarea_field( $value );
			default:
				return sanitize_text_field( $value );
		}
	}

	/**
	 * A group value must reference a defined color guide.
	 */
	public static function sanitize_group( $value ) {
		$value = sanitize_key( $value );
		return ( $value && isset( TeamGraph_Groups::get_all()[ $value ] ) ) ? $value : '';
	}

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
	}

	public static function register() {
		register_post_type(
			self::CPT,
			array(
				'labels'       => array(
					'name'          => __( 'Team Members', 'teamgraph' ),
					'singular_name' => __( 'Team Member', 'teamgraph' ),
				),
				'public'       => false,
				'show_ui'      => false, // All admin UI is custom React screens.
				'show_in_rest' => false, // We expose our own REST namespace.
				'hierarchical' => true,  // "Reports to" is post_parent.
				'supports'     => array( 'title', 'editor', 'thumbnail', 'page-attributes' ), // Bio is post_content.
			)
		);

		register_taxonomy(
			self::TAXONOMY,
			self::CPT,
			array(
				'labels'       => array(
					'name'          => __( 'Departments', 'teamgraph' ),
					'singular_name' => __( 'Department', 'teamgraph' ),
				),
				'public'       => false,
				'show_ui'      => false,
				'show_in_rest' => false,
				'hierarchical' => false, // Flat: no divisions.
			)
		);

		register_taxonomy(
			self::LOCATION,
			self::CPT,
			array(
				'labels'       => array(
					'name'          => __( 'Locations', 'teamgraph' ),
					'singular_name' => __( 'Location', 'teamgraph' ),
				),
				'public'       => false,
				'show_ui'      => false,
				'show_in_rest' => false,
				'hierarchical' => false,
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Member accessors
	 * ------------------------------------------------------------------- */

	/**
	 * The member's own department term, or null when inheriting.
	 */
	public static function get_own_department( $post_id ) {
		$terms = get_the_terms( $post_id, self::TAXONOMY );
		return ( $terms && ! is_wp_error( $terms ) ) ? $terms[0] : null;
	}

	/**
	 * The member's location term, or null when none is assigned. Unlike
	 * departments, locations do not inherit from the manager.
	 */
	public static function get_own_location( $post_id ) {
		$terms = get_the_terms( $post_id, self::LOCATION );
		return ( $terms && ! is_wp_error( $terms ) ) ? $terms[0] : null;
	}

	/**
	 * Flat member record for REST responses and admin lists.
	 */
	public static function member_record( $post ) {
		$post = get_post( $post );
		if ( ! $post ) {
			return null;
		}
		$dept     = self::get_own_department( $post->ID );
		$location = self::get_own_location( $post->ID );
		$record   = array(
			'id'         => $post->ID,
			'name'       => $post->post_title,
			'parent'     => $post->post_parent,
			'order'      => (int) $post->menu_order,
			'bio'        => $post->post_content,
			'photo_id'   => (int) get_post_thumbnail_id( $post->ID ),
			'photo_url'  => get_the_post_thumbnail_url( $post->ID, 'thumbnail' ) ?: '',
			'department' => $dept ? $dept->term_id : 0,
			'location'   => $location ? $location->term_id : 0,
			'reports'    => count(
				get_posts(
					array(
						'post_type'      => self::CPT,
						'post_parent'    => $post->ID,
						'post_status'    => 'publish',
						'fields'         => 'ids',
						'posts_per_page' => -1,
					)
				)
			),
		);
		foreach ( self::field_map() as $field => $spec ) {
			$record[ $field ] = get_post_meta( $post->ID, $spec['meta_key'], true );
		}

		return apply_filters( 'teamgraph_member_record', $record, $post );
	}

	/**
	 * All published members ordered for tree assembly.
	 *
	 * @return WP_Post[]
	 */
	public static function all_members() {
		return get_posts(
			array(
				'post_type'      => self::CPT,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => array(
					'menu_order' => 'ASC',
					'title'      => 'ASC',
				),
				'order'          => 'ASC',
			)
		);
	}

	/**
	 * True when $candidate_parent is $post_id itself or one of its
	 * descendants — assigning it would create a cycle.
	 */
	public static function creates_cycle( $post_id, $candidate_parent ) {
		$walk  = (int) $candidate_parent;
		$guard = 0;
		while ( $walk && $guard < 1000 ) {
			if ( $walk === (int) $post_id ) {
				return true;
			}
			$walk = (int) wp_get_post_parent_id( $walk );
			$guard++;
		}
		return false;
	}

	/**
	 * Direct reports (published) of a member, as posts.
	 *
	 * @return WP_Post[]
	 */
	public static function direct_reports( $post_id ) {
		return get_posts(
			array(
				'post_type'      => self::CPT,
				'post_parent'    => (int) $post_id,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Tree building
	 * ------------------------------------------------------------------- */

	/**
	 * The org tree with department inheritance, auto department pills, and
	 * resolved color-guide styles.
	 *
	 * @param int $root_id Optional member id to build a subtree from. 0 (the
	 *                     default) builds the whole organization. A subtree is
	 *                     styled as its own chart: department pills and color
	 *                     guides restart at the given root.
	 * @return array[] Root nodes.
	 */
	public static function build_tree( $root_id = 0 ) {
		$members  = self::all_members();
		$children = array();
		$records  = array();

		foreach ( $members as $post ) {
			$rec                          = self::member_record( $post );
			$records[ $post->ID ]         = $rec;
			$children[ $rec['parent'] ][] = $post->ID;
		}

		// One meta-cache prime for every headshot attachment, so per-node
		// alt-text lookups below don't each hit the database.
		$photo_ids = array_filter( wp_list_pluck( $records, 'photo_id' ) );
		if ( $photo_ids ) {
			update_meta_cache( 'post', $photo_ids );
		}

		if ( $root_id ) {
			$roots = isset( $records[ $root_id ] ) ? array( (int) $root_id ) : array();
		} else {
			// Any node whose parent isn't a known member becomes a root
			// (covers parent = 0 and orphans left by unexpected deletions).
			$roots = array();
			foreach ( $children as $parent_id => $ids ) {
				if ( $parent_id && isset( $records[ $parent_id ] ) ) {
					continue;
				}
				$roots = array_merge( $roots, $ids );
			}
		}

		$terms  = self::department_terms();
		$guides = TeamGraph_Groups::get_all();

		$build = function ( $id, $inherited_dept, $group_stack ) use ( &$build, &$records, &$children, $terms, $guides ) {
			$rec  = $records[ $id ];
			$dept = $rec['department'] ? $rec['department'] : $inherited_dept;

			// Color guide: an explicit assignment starts (or, when already one
			// level deep, replaces) a group; levels restart at 0. One level of
			// nesting is supported — deeper assignments swap the nested group.
			if ( $rec['group'] && isset( $guides[ $rec['group'] ] ) ) {
				if ( count( $group_stack ) >= 2 ) {
					array_pop( $group_stack );
				}
				$group_stack[] = array(
					'id'    => $rec['group'],
					'level' => 0,
				);
			} elseif ( ! empty( $group_stack ) ) {
				$group_stack[ count( $group_stack ) - 1 ]['level']++;
			}

			$style = null;
			if ( ! empty( $group_stack ) ) {
				$active = $group_stack[ count( $group_stack ) - 1 ];
				$levels = $guides[ $active['id'] ]['levels'];
				// Levels deeper than the guide defines reuse the last one.
				$style = $levels[ min( $active['level'], count( $levels ) - 1 ) ];
			}

			$node = array(
				'id'        => $rec['id'],
				'name'      => $rec['name'],
				'job_title' => $rec['job_title'],
				'email'     => $rec['email'],
				'phone'     => $rec['phone'],
				'link_url'  => $rec['link_url'],
				'photo_url' => $rec['photo_url'],
				'photo_id'  => $rec['photo_id'],
				'photo_alt' => $rec['photo_id'] ? (string) get_post_meta( $rec['photo_id'], '_wp_attachment_image_alt', true ) : '',
				'parent'    => $rec['parent'],
				'group'     => $rec['group'],
				'dept'      => $dept,
				'dept_own'  => (bool) $rec['department'],
				'location'  => $rec['location'],
				'style'     => $style,
				'pills'     => array(),
				'children'  => array(),
			);

			foreach ( isset( $children[ $id ] ) ? $children[ $id ] : array() as $child_id ) {
				$child = $build( $child_id, $dept, $group_stack );

				// Auto pill nodes: where a branch's effective department
				// diverges from its parent's, label the branch.
				$child['pills'] = self::department_pill( $dept, $child['dept'], $terms );

				$node['children'][] = $child;
			}

			/**
			 * Filter a resolved front-end tree node. $rec is the flat member
			 * record (including any fields added via teamgraph_member_fields),
			 * so extensions can copy extra fields onto the node for card
			 * rendering. Children are already attached; the parent assigns
			 * this node's pills after the filter runs.
			 */
			return apply_filters( 'teamgraph_tree_node', $node, $rec );
		};

		$tree = array();
		foreach ( array_unique( $roots ) as $root_id ) {
			$root = $build( $root_id, 0, array() );
			// Top-level branches with an assignment get pills too.
			$root['pills'] = self::department_pill( 0, $root['dept'], $terms );
			$tree[]        = $root;
		}

		return $tree;
	}

	/**
	 * The pill to show above a node whose effective department differs from
	 * its parent's.
	 *
	 * @return array[] Zero or one: ['label' => string, 'type' => 'department'].
	 */
	private static function department_pill( $parent_term_id, $term_id, $terms ) {
		if ( (int) $parent_term_id === (int) $term_id || ! $term_id || ! isset( $terms[ $term_id ] ) ) {
			return array();
		}
		return array(
			array(
				'label' => $terms[ $term_id ]['name'],
				'type'  => 'department',
			),
		);
	}

	/**
	 * All department terms keyed by id: ['id','name'].
	 */
	public static function department_terms() {
		return self::terms_map( self::TAXONOMY );
	}

	/**
	 * All location terms keyed by id: ['id','name'].
	 */
	public static function location_terms() {
		return self::terms_map( self::LOCATION );
	}

	private static function terms_map( $taxonomy ) {
		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => false,
			)
		);
		$map = array();
		if ( ! is_wp_error( $terms ) ) {
			foreach ( $terms as $t ) {
				$map[ $t->term_id ] = array(
					'id'   => $t->term_id,
					'name' => $t->name,
				);
			}
		}
		return $map;
	}
}
