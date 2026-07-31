<?php
/**
 * Demo data: a small sample organization (members, departments, one color
 * guide) for onboarding. Everything seeded here is tagged so it can be
 * removed cleanly without touching real content.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Demo {

	const META     = '_teamgraph_demo';
	const GUIDE_ID = 'demo_guide';

	/**
	 * True when demo members are present.
	 */
	public static function exists() {
		$posts = get_posts(
			array(
				'post_type'      => TeamGraph_Data::CPT,
				'post_status'    => 'any',
				'meta_key'       => self::META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sample-data maintenance on a tiny dataset.
				'fields'         => 'ids',
				'posts_per_page' => 1,
			)
		);
		return ! empty( $posts );
	}

	/**
	 * Seed the sample organization. Refuses to run twice.
	 *
	 * @return array|WP_Error Counts of created content.
	 */
	public static function seed() {
		if ( self::exists() ) {
			return new WP_Error( 'teamgraph_demo_exists', __( 'Sample data is already loaded.', 'teamgraph' ), array( 'status' => 409 ) );
		}

		// Color guide (appended to the option only if the id is free).
		$groups = get_option( TeamGraph_Groups::OPTION, array() );
		if ( ! is_array( $groups ) ) {
			$groups = array();
		}
		$have_guide = false;
		foreach ( $groups as $group ) {
			if ( isset( $group['id'] ) && self::GUIDE_ID === $group['id'] ) {
				$have_guide = true;
				break;
			}
		}
		if ( ! $have_guide ) {
			$groups[] = array(
				'id'     => self::GUIDE_ID,
				'name'   => __( 'Sample: Executive Blue', 'teamgraph' ),
				'levels' => array(
					array( 'bg' => '#344563', 'bg2' => '#22304a', 'text' => '#ffffff', 'pill_bg' => '#1d2941', 'pill_text' => '#ffffff' ),
					array( 'bg' => '#e8edf6', 'bg2' => '', 'text' => '#1e2430', 'pill_bg' => '#344563', 'pill_text' => '#ffffff' ),
					array( 'bg' => '#ffffff', 'bg2' => '', 'text' => '#1e2430', 'pill_bg' => '#5a6880', 'pill_text' => '#ffffff' ),
				),
			);
			update_option( TeamGraph_Groups::OPTION, $groups, false );
		}

		// Flat departments and locations. Existing terms with the same name
		// are reused but not tagged, so removal never deletes terms the user
		// created themselves.
		$dept_ids = array();
		foreach ( array( 'Operations', 'Engineering', 'Marketing' ) as $name ) {
			$dept_ids[ $name ] = self::term( $name, TeamGraph_Data::TAXONOMY );
		}
		$location_ids = array();
		foreach ( array( 'Springfield HQ', 'Remote' ) as $name ) {
			$location_ids[ $name ] = self::term( $name, TeamGraph_Data::LOCATION );
		}

		// Members: [ name, title, manager key, department key|'', email?, phone?, location key|'', bio? ].
		$people = array(
			'ceo'      => array( 'Alexandra Reyes', 'Chief Executive Officer', '', '', 'alexandra@example.com', '+1 555 010 1000', 'Springfield HQ', 'Alexandra founded the company in 2014 and leads its overall strategy.' ),
			'coo'      => array( 'Marcus Webb', 'Chief Operating Officer', 'ceo', 'Operations', 'marcus@example.com', '+1 555 010 1001', 'Springfield HQ', 'Marcus keeps day-to-day operations running smoothly.' ),
			'cto'      => array( 'Priya Sharma', 'Chief Technology Officer', 'ceo', 'Engineering', 'priya@example.com', '+1 555 010 1002', 'Remote', 'Priya oversees the engineering organization and technical direction.' ),
			'cmo'      => array( 'Daniel Kim', 'Chief Marketing Officer', 'ceo', 'Marketing', 'daniel@example.com', '+1 555 010 1003', 'Springfield HQ', '' ),
			'hr'       => array( 'Grace Otieno', 'HR Manager', 'coo', '', 'grace@example.com', '', 'Springfield HQ', '' ),
			'office'   => array( 'Tom Bradley', 'Office Manager', 'coo', '', 'tom@example.com', '', 'Springfield HQ', '' ),
			'engmgr'   => array( 'Sofia Ali', 'Engineering Manager', 'cto', '', 'sofia@example.com', '', 'Remote', '' ),
			'eng1'     => array( 'Jae Park', 'Senior Engineer', 'engmgr', '', 'jae@example.com', '', 'Remote', '' ),
			'eng2'     => array( 'Lena Fischer', 'Engineer', 'engmgr', '', 'lena@example.com', '', 'Remote', '' ),
			'qa'       => array( 'Ravi Patel', 'QA Lead', 'cto', '', 'ravi@example.com', '', 'Remote', '' ),
			'content'  => array( 'Maya Johnson', 'Content Lead', 'cmo', '', 'maya@example.com', '', 'Springfield HQ', '' ),
			'designer' => array( 'Oliver Grant', 'Designer', 'cmo', '', 'oliver@example.com', '', 'Remote', '' ),
		);

		$ids     = array();
		$order   = array();
		$created = 0;
		foreach ( $people as $key => $person ) {
			list( $name, $title, $manager, $department, $email, $phone, $location, $bio ) = $person;

			$parent            = $manager ? $ids[ $manager ] : 0;
			$order[ $parent ]  = isset( $order[ $parent ] ) ? $order[ $parent ] + 1 : 0;

			$post_id = wp_insert_post(
				array(
					'post_type'    => TeamGraph_Data::CPT,
					'post_status'  => 'publish',
					'post_title'   => $name,
					'post_content' => $bio,
					'post_parent'  => $parent,
					'menu_order'   => $order[ $parent ],
				),
				true
			);
			if ( is_wp_error( $post_id ) ) {
				return $post_id;
			}

			update_post_meta( $post_id, self::META, 1 );
			update_post_meta( $post_id, '_teamgraph_job_title', $title );
			if ( $email ) {
				update_post_meta( $post_id, '_teamgraph_email', $email );
			}
			if ( $phone ) {
				update_post_meta( $post_id, '_teamgraph_phone', $phone );
			}
			if ( 'ceo' === $key ) {
				update_post_meta( $post_id, '_teamgraph_group', self::GUIDE_ID );
			}
			if ( $department && ! empty( $dept_ids[ $department ] ) ) {
				wp_set_object_terms( $post_id, array( $dept_ids[ $department ] ), TeamGraph_Data::TAXONOMY );
			}
			if ( $location && ! empty( $location_ids[ $location ] ) ) {
				wp_set_object_terms( $post_id, array( $location_ids[ $location ] ), TeamGraph_Data::LOCATION );
			}

			$ids[ $key ] = $post_id;
			$created++;
		}

		return array(
			'members'     => $created,
			'departments' => count( array_filter( $dept_ids ) ),
			'locations'   => count( array_filter( $location_ids ) ),
			'guide'       => ! $have_guide,
		);
	}

	/**
	 * Remove everything seed() created: tagged members (bypassing trash),
	 * tagged terms, and the sample color guide.
	 */
	public static function remove() {
		$posts = get_posts(
			array(
				'post_type'      => TeamGraph_Data::CPT,
				'post_status'    => 'any',
				'meta_key'       => self::META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sample-data maintenance on a tiny dataset.
				'fields'         => 'ids',
				'posts_per_page' => -1,
			)
		);
		foreach ( $posts as $post_id ) {
			wp_delete_post( $post_id, true );
		}

		$deleted_terms = 0;
		foreach ( array( TeamGraph_Data::TAXONOMY, TeamGraph_Data::LOCATION ) as $taxonomy ) {
			$terms = get_terms(
				array(
					'taxonomy'   => $taxonomy,
					'hide_empty' => false,
					'meta_key'   => self::META, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- admin-only sample-data maintenance on a tiny dataset.
				)
			);
			if ( is_wp_error( $terms ) ) {
				continue;
			}
			foreach ( $terms as $term ) {
				wp_delete_term( $term->term_id, $taxonomy );
				$deleted_terms++;
			}
		}

		$groups = get_option( TeamGraph_Groups::OPTION, array() );
		if ( is_array( $groups ) ) {
			$filtered = array_values(
				array_filter(
					$groups,
					function ( $group ) {
						return ! isset( $group['id'] ) || self::GUIDE_ID !== $group['id'];
					}
				)
			);
			if ( count( $filtered ) !== count( $groups ) ) {
				update_option( TeamGraph_Groups::OPTION, $filtered, false );
			}
		}

		return array(
			'members'     => count( $posts ),
			'departments' => $deleted_terms,
		);
	}

	/**
	 * Create (and tag) a term, or reuse an existing one untagged.
	 */
	private static function term( $name, $taxonomy ) {
		$result = wp_insert_term( $name, $taxonomy );
		if ( is_wp_error( $result ) ) {
			$existing = $result->get_error_data( 'term_exists' );
			return $existing ? (int) $existing : 0;
		}
		add_term_meta( $result['term_id'], self::META, 1 );
		return (int) $result['term_id'];
	}
}
