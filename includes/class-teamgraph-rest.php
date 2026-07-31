<?php
/**
 * REST API (teamgraph/v1). Every safeguard the admin UI enforces is re-checked
 * here: capability per action, cycle prevention, re-parenting on delete,
 * color validation, order persistence.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Rest {

	const NS = 'teamgraph/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function can_manage_members() {
		/**
		 * Filter the capability required for an TeamGraph action. The second
		 * argument names the action context so extensions can grant, e.g.,
		 * member management to a custom role without opening settings.
		 */
		return current_user_can( apply_filters( 'teamgraph_capability', 'edit_others_posts', 'manage_members' ) );
	}

	public static function can_manage_settings() {
		return current_user_can( apply_filters( 'teamgraph_capability', 'manage_options', 'manage_settings' ) );
	}

	public static function routes() {
		register_rest_route(
			self::NS,
			'/members',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'list_members' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'create_member' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/members/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_member' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'update_member' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'delete_member' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/reorder',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'reorder' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/members/bulk-delete',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'bulk_delete_members' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/members/restore',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'restore_members' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/members/purge',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'purge_members' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/trash/empty',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'empty_trash' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/tree',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'get_tree' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		// Departments and locations share the same flat-term CRUD.
		foreach ( array(
			'departments' => TeamGraph_Data::TAXONOMY,
			'locations'   => TeamGraph_Data::LOCATION,
		) as $base => $taxonomy ) {
			register_rest_route(
				self::NS,
				'/' . $base,
				array(
					array(
						'methods'             => 'GET',
						'callback'            => function () use ( $taxonomy ) {
							return self::list_terms( $taxonomy );
						},
						'permission_callback' => array( __CLASS__, 'can_manage_members' ),
					),
					array(
						'methods'             => 'POST',
						'callback'            => function ( WP_REST_Request $request ) use ( $taxonomy ) {
							return self::create_term( $request, $taxonomy );
						},
						'permission_callback' => array( __CLASS__, 'can_manage_members' ),
					),
				)
			);

			register_rest_route(
				self::NS,
				'/' . $base . '/(?P<id>\d+)',
				array(
					array(
						'methods'             => 'PUT',
						'callback'            => function ( WP_REST_Request $request ) use ( $taxonomy ) {
							return self::update_term( $request, $taxonomy );
						},
						'permission_callback' => array( __CLASS__, 'can_manage_members' ),
					),
					array(
						'methods'             => 'DELETE',
						'callback'            => function ( WP_REST_Request $request ) use ( $taxonomy ) {
							return self::delete_term( $request, $taxonomy );
						},
						'permission_callback' => array( __CLASS__, 'can_manage_members' ),
					),
				)
			);
		}

		register_rest_route(
			self::NS,
			'/settings',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage_settings' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'save_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage_settings' ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/demo',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'demo_status' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'demo_seed' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'demo_remove' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
			)
		);

		register_rest_route(
			self::NS,
			'/csv/export',
			array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'csv_export' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/csv/import',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'csv_import' ),
				'permission_callback' => array( __CLASS__, 'can_manage_members' ),
			)
		);

		register_rest_route(
			self::NS,
			'/groups',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'get_groups' ),
					'permission_callback' => array( __CLASS__, 'can_manage_members' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'save_groups' ),
					'permission_callback' => array( __CLASS__, 'can_manage_settings' ),
				),
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Members
	 * ------------------------------------------------------------------- */

	public static function list_members( WP_REST_Request $request ) {
		$search    = sanitize_text_field( $request->get_param( 'search' ) ?? '' );
		$top_level = rest_sanitize_boolean( $request->get_param( 'top_level' ) );
		$status    = 'trash' === $request->get_param( 'status' ) ? 'trash' : 'publish';
		$orderby   = $request->get_param( 'orderby' ) ?? 'title';
		$order     = strtoupper( $request->get_param( 'order' ) ?? 'ASC' ) === 'DESC' ? 'DESC' : 'ASC';
		$page      = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
		$per_page  = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?? 20 ) ) );

		$args = array(
			'post_type'      => TeamGraph_Data::CPT,
			'post_status'    => $status,
			'paged'          => $page,
			'posts_per_page' => $per_page,
			's'              => $search,
			'order'          => $order,
		);

		if ( 'order' === $orderby ) {
			$args['orderby'] = array(
				'menu_order' => $order,
				'title'      => 'ASC',
			);
		} else {
			$args['orderby'] = 'title';
		}

		// Top-level filtering only makes sense for the live hierarchy.
		if ( $top_level && 'publish' === $status ) {
			$args['post_parent'] = 0;
		}

		$query = new WP_Query( $args );
		$items = array_map( array( 'TeamGraph_Data', 'member_record' ), $query->posts );

		return rest_ensure_response(
			array(
				'items' => $items,
				'total' => (int) $query->found_posts,
				'pages' => (int) $query->max_num_pages,
			)
		);
	}

	public static function get_member( WP_REST_Request $request ) {
		$record = self::member_or_error( (int) $request['id'] );
		return is_wp_error( $record ) ? $record : rest_ensure_response( TeamGraph_Data::member_record( $record ) );
	}

	public static function create_member( WP_REST_Request $request ) {
		return self::save_member( $request, 0 );
	}

	public static function update_member( WP_REST_Request $request ) {
		$post = self::member_or_error( (int) $request['id'] );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		return self::save_member( $request, $post->ID );
	}

	/**
	 * Shared create/update. Validates name, parent existence, and cycles
	 * before touching the database.
	 */
	private static function save_member( WP_REST_Request $request, $post_id ) {
		$name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
		if ( '' === $name ) {
			return new WP_Error( 'teamgraph_name_required', __( 'A name is required.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$parent = $request->has_param( 'parent' ) ? (int) $request->get_param( 'parent' ) : null;
		if ( null !== $parent && $parent > 0 ) {
			$parent_post = get_post( $parent );
			if ( ! $parent_post || TeamGraph_Data::CPT !== $parent_post->post_type || 'publish' !== $parent_post->post_status ) {
				return new WP_Error( 'teamgraph_bad_parent', __( 'The selected manager does not exist.', 'teamgraph' ), array( 'status' => 400 ) );
			}
			if ( $post_id && TeamGraph_Data::creates_cycle( $post_id, $parent ) ) {
				return new WP_Error( 'teamgraph_cycle', __( 'A member cannot report to themselves or to one of their own reports.', 'teamgraph' ), array( 'status' => 409 ) );
			}
		}

		$postarr = array(
			'post_type'   => TeamGraph_Data::CPT,
			'post_status' => 'publish',
			'post_title'  => $name,
		);
		if ( $post_id ) {
			$postarr['ID'] = $post_id;
		}
		if ( null !== $parent ) {
			$postarr['post_parent'] = max( 0, $parent );
		}
		if ( $request->has_param( 'order' ) ) {
			$postarr['menu_order'] = (int) $request->get_param( 'order' );
		}
		if ( $request->has_param( 'bio' ) ) {
			$postarr['post_content'] = wp_kses_post( $request->get_param( 'bio' ) );
		}

		$result = $post_id ? wp_update_post( $postarr, true ) : wp_insert_post( $postarr, true );
		if ( is_wp_error( $result ) ) {
			$result->add_data( array( 'status' => 500 ) );
			return $result;
		}
		$post_id = (int) $result;

		// A hand-set manager overrides any pending restore hint from a trashed
		// former manager, so a later restore won't pull this member away again.
		if ( null !== $parent ) {
			delete_post_meta( $post_id, TeamGraph_Data::PARENT_HINT_META );
		}

		foreach ( TeamGraph_Data::field_map() as $field => $spec ) {
			if ( ! $request->has_param( $field ) ) {
				continue;
			}
			$value = TeamGraph_Data::sanitize_field_value( $request->get_param( $field ), $spec['sanitize'] );
			update_post_meta( $post_id, $spec['meta_key'], $value );
		}

		if ( $request->has_param( 'photo_id' ) ) {
			$photo_id = (int) $request->get_param( 'photo_id' );
			if ( $photo_id && 'attachment' === get_post_type( $photo_id ) ) {
				set_post_thumbnail( $post_id, $photo_id );
			} elseif ( ! $photo_id ) {
				delete_post_thumbnail( $post_id );
			}
		}

		// Term assignments: department (0 = inherit from manager) and
		// location (0 = none).
		foreach ( array(
			'department' => TeamGraph_Data::TAXONOMY,
			'location'   => TeamGraph_Data::LOCATION,
		) as $param => $taxonomy ) {
			if ( ! $request->has_param( $param ) ) {
				continue;
			}
			$term_id = (int) $request->get_param( $param );
			if ( $term_id ) {
				$term = get_term( $term_id, $taxonomy );
				if ( ! $term || is_wp_error( $term ) ) {
					return new WP_Error(
						'teamgraph_bad_term',
						'department' === $param
							? __( 'The selected department does not exist.', 'teamgraph' )
							: __( 'The selected location does not exist.', 'teamgraph' ),
						array( 'status' => 400 )
					);
				}
				wp_set_object_terms( $post_id, array( $term_id ), $taxonomy );
			} else {
				wp_set_object_terms( $post_id, array(), $taxonomy );
			}
		}

		return rest_ensure_response( TeamGraph_Data::member_record( $post_id ) );
	}

	public static function delete_member( WP_REST_Request $request ) {
		$post = self::member_or_error( (int) $request['id'] );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		self::trash_and_reparent( $post );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	/**
	 * Delete every member in { ids: int[] }. Each deleted member's direct
	 * reports move up to the deleted member's own manager, so trashing a
	 * manager never strands their branch.
	 *
	 * @return array{deleted: int[]}
	 */
	public static function bulk_delete_members( WP_REST_Request $request ) {
		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'ids must be a non-empty array.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$deleted = array();
		foreach ( array_map( 'intval', $ids ) as $id ) {
			$post = get_post( $id );
			if ( ! $post || TeamGraph_Data::CPT !== $post->post_type || 'publish' !== $post->post_status ) {
				continue;
			}
			self::trash_and_reparent( $post );
			$deleted[] = $id;
		}

		return rest_ensure_response( array( 'deleted' => $deleted ) );
	}

	/**
	 * Trash a member after re-parenting their direct reports to the member's
	 * own manager (wp_trash_post leaves children pointing at the trashed
	 * post, which would orphan the branch). Each report is stamped with the
	 * trashed manager's id so restoring the manager can rebuild the branch.
	 */
	private static function trash_and_reparent( $post ) {
		foreach ( TeamGraph_Data::direct_reports( $post->ID ) as $report ) {
			update_post_meta( $report->ID, TeamGraph_Data::PARENT_HINT_META, $post->ID );
			wp_update_post(
				array(
					'ID'          => $report->ID,
					'post_parent' => $post->post_parent,
				)
			);
		}
		wp_trash_post( $post->ID );
	}

	/**
	 * Restore trashed members from { ids: int[] }. Each member returns to
	 * published status, and any reports that were moved up when it was trashed
	 * (still carrying the hint meta) are re-attached, rebuilding the branch.
	 *
	 * @return array{restored: int[]}
	 */
	public static function restore_members( WP_REST_Request $request ) {
		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'ids must be a non-empty array.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$restored = array();
		foreach ( array_map( 'intval', $ids ) as $id ) {
			$post = get_post( $id );
			if ( ! $post || TeamGraph_Data::CPT !== $post->post_type || 'trash' !== $post->post_status ) {
				continue;
			}
			wp_untrash_post( $id );
			// untrash may land in 'draft' on some setups; force publish.
			if ( 'publish' !== get_post_status( $id ) ) {
				wp_update_post(
					array(
						'ID'          => $id,
						'post_status' => 'publish',
					)
				);
			}
			self::reattach_reports( $id );
			$restored[] = $id;
		}

		return rest_ensure_response( array( 'restored' => $restored ) );
	}

	/**
	 * Re-attach every published member still pointing at $manager_id via the
	 * hint meta, then clear the hint. Skips members whose manager was changed
	 * by hand (that clears the hint at the point of change).
	 */
	private static function reattach_reports( $manager_id ) {
		$reports = get_posts(
			array(
				'post_type'      => TeamGraph_Data::CPT,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'meta_key'       => TeamGraph_Data::PARENT_HINT_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- one-off restore action.
				'meta_value'     => (int) $manager_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- exact-match lookup on a small set.
			)
		);
		foreach ( $reports as $report ) {
			wp_update_post(
				array(
					'ID'          => $report->ID,
					'post_parent' => (int) $manager_id,
				)
			);
			delete_post_meta( $report->ID, TeamGraph_Data::PARENT_HINT_META );
		}
	}

	/**
	 * Permanently delete trashed members from { ids: int[] }. Any dangling
	 * restore hints pointing at them are cleared first.
	 *
	 * @return array{purged: int[]}
	 */
	public static function purge_members( WP_REST_Request $request ) {
		$ids = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'ids must be a non-empty array.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$purged = array();
		foreach ( array_map( 'intval', $ids ) as $id ) {
			$post = get_post( $id );
			if ( ! $post || TeamGraph_Data::CPT !== $post->post_type || 'trash' !== $post->post_status ) {
				continue;
			}
			self::clear_hints_to( $id );
			wp_delete_post( $id, true );
			$purged[] = $id;
		}

		return rest_ensure_response( array( 'purged' => $purged ) );
	}

	/**
	 * Permanently delete every trashed member.
	 *
	 * @return array{purged: int}
	 */
	public static function empty_trash() {
		$ids = get_posts(
			array(
				'post_type'      => TeamGraph_Data::CPT,
				'post_status'    => 'trash',
				'fields'         => 'ids',
				'posts_per_page' => -1,
			)
		);
		foreach ( $ids as $id ) {
			self::clear_hints_to( $id );
			wp_delete_post( $id, true );
		}
		return rest_ensure_response( array( 'purged' => count( $ids ) ) );
	}

	/**
	 * Drop any restore hints that point at $manager_id (it is gone for good).
	 */
	private static function clear_hints_to( $manager_id ) {
		$reports = get_posts(
			array(
				'post_type'      => TeamGraph_Data::CPT,
				'post_status'    => array( 'publish', 'trash' ),
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_key'       => TeamGraph_Data::PARENT_HINT_META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- one-off cleanup on delete.
				'meta_value'     => (int) $manager_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- exact-match lookup on a small set.
			)
		);
		foreach ( $reports as $report_id ) {
			delete_post_meta( $report_id, TeamGraph_Data::PARENT_HINT_META );
		}
	}

	/**
	 * Persist sibling order: { parent: int, ids: int[] }. Also re-parents the
	 * listed members to $parent, so a builder drop is a single request.
	 */
	public static function reorder( WP_REST_Request $request ) {
		$parent = (int) $request->get_param( 'parent' );
		$ids    = $request->get_param( 'ids' );
		if ( ! is_array( $ids ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'ids must be an array.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		if ( $parent ) {
			$parent_post = get_post( $parent );
			if ( ! $parent_post || TeamGraph_Data::CPT !== $parent_post->post_type ) {
				return new WP_Error( 'teamgraph_bad_parent', __( 'The selected manager does not exist.', 'teamgraph' ), array( 'status' => 400 ) );
			}
		}

		foreach ( array_map( 'intval', $ids ) as $order => $id ) {
			$post = get_post( $id );
			if ( ! $post || TeamGraph_Data::CPT !== $post->post_type ) {
				continue;
			}
			if ( $parent && TeamGraph_Data::creates_cycle( $id, $parent ) ) {
				return new WP_Error( 'teamgraph_cycle', __( 'A member cannot report to themselves or to one of their own reports.', 'teamgraph' ), array( 'status' => 409 ) );
			}
			wp_update_post(
				array(
					'ID'          => $id,
					'post_parent' => $parent,
					'menu_order'  => $order,
				)
			);
			// A deliberate move clears any pending restore hint.
			delete_post_meta( $id, TeamGraph_Data::PARENT_HINT_META );
		}

		return rest_ensure_response( array( 'saved' => true ) );
	}

	public static function get_tree( WP_REST_Request $request ) {
		$root = (int) ( $request->get_param( 'root' ) ?? 0 );
		return rest_ensure_response(
			array(
				'tree'        => TeamGraph_Data::build_tree( $root ),
				'departments' => array_values( TeamGraph_Data::department_terms() ),
				'locations'   => array_values( TeamGraph_Data::location_terms() ),
				'groups'      => array_values( TeamGraph_Groups::get_all() ),
			)
		);
	}

	/* ---------------------------------------------------------------------
	 * Departments & locations (flat terms, shared handlers)
	 * ------------------------------------------------------------------- */

	private static function list_terms( $taxonomy ) {
		return rest_ensure_response( array_values( self::terms_map( $taxonomy ) ) );
	}

	private static function create_term( WP_REST_Request $request, $taxonomy ) {
		$name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
		if ( '' === $name ) {
			return new WP_Error( 'teamgraph_name_required', __( 'A name is required.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$result = wp_insert_term( $name, $taxonomy );
		if ( is_wp_error( $result ) ) {
			$result->add_data( array( 'status' => 400 ) );
			return $result;
		}
		return rest_ensure_response( self::terms_map( $taxonomy )[ $result['term_id'] ] );
	}

	private static function update_term( WP_REST_Request $request, $taxonomy ) {
		$term = get_term( (int) $request['id'], $taxonomy );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'teamgraph_not_found', __( 'Not found.', 'teamgraph' ), array( 'status' => 404 ) );
		}

		$name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
		if ( '' === $name ) {
			return new WP_Error( 'teamgraph_name_required', __( 'A name is required.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$result = wp_update_term( $term->term_id, $taxonomy, array( 'name' => $name ) );
		if ( is_wp_error( $result ) ) {
			$result->add_data( array( 'status' => 400 ) );
			return $result;
		}
		return rest_ensure_response( self::terms_map( $taxonomy )[ $term->term_id ] );
	}

	private static function delete_term( WP_REST_Request $request, $taxonomy ) {
		$term = get_term( (int) $request['id'], $taxonomy );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'teamgraph_not_found', __( 'Not found.', 'teamgraph' ), array( 'status' => 404 ) );
		}
		wp_delete_term( $term->term_id, $taxonomy );
		return rest_ensure_response( array( 'deleted' => true ) );
	}

	private static function terms_map( $taxonomy ) {
		return TeamGraph_Data::LOCATION === $taxonomy
			? TeamGraph_Data::location_terms()
			: TeamGraph_Data::department_terms();
	}

	/* ---------------------------------------------------------------------
	 * Settings
	 * ------------------------------------------------------------------- */

	public static function get_settings() {
		return rest_ensure_response( TeamGraph_Settings::get() );
	}

	public static function save_settings( WP_REST_Request $request ) {
		$result = TeamGraph_Settings::save( $request->get_json_params() );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/* ---------------------------------------------------------------------
	 * Demo data
	 * ------------------------------------------------------------------- */

	public static function demo_status() {
		return rest_ensure_response( array( 'exists' => TeamGraph_Demo::exists() ) );
	}

	public static function demo_seed() {
		$result = TeamGraph_Demo::seed();
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	public static function demo_remove() {
		return rest_ensure_response( TeamGraph_Demo::remove() );
	}

	/* ---------------------------------------------------------------------
	 * CSV import/export
	 * ------------------------------------------------------------------- */

	public static function csv_export() {
		return rest_ensure_response( TeamGraph_CSV::export() );
	}

	public static function csv_import( WP_REST_Request $request ) {
		$result = TeamGraph_CSV::import( (string) $request->get_param( 'csv' ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/* ---------------------------------------------------------------------
	 * Styling groups
	 * ------------------------------------------------------------------- */

	public static function get_groups() {
		return rest_ensure_response( array_values( TeamGraph_Groups::get_all() ) );
	}

	public static function save_groups( WP_REST_Request $request ) {
		$result = TeamGraph_Groups::save_all( $request->get_param( 'groups' ) );
		return is_wp_error( $result ) ? $result : rest_ensure_response( array_values( $result ) );
	}

	/* ---------------------------------------------------------------------
	 * Helpers
	 * ------------------------------------------------------------------- */

	private static function member_or_error( $id ) {
		$post = get_post( $id );
		if ( ! $post || TeamGraph_Data::CPT !== $post->post_type || 'publish' !== $post->post_status ) {
			return new WP_Error( 'teamgraph_not_found', __( 'Member not found.', 'teamgraph' ), array( 'status' => 404 ) );
		}
		return $post;
	}
}
