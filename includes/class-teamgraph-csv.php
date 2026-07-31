<?php
/**
 * CSV import/export. Export writes one row per member with human-readable
 * references (manager, department, and location by name). Import accepts the
 * same format: rows are matched to existing members by name (update) or
 * created, unknown departments/locations are created on the fly, and manager
 * links are resolved in a second pass so row order never matters.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/*
 * CSV is built and parsed entirely in an in-memory php://temp stream — no real
 * files are ever touched — so the WP_Filesystem API does not apply. The direct
 * stream calls below are intentional; the sniff is disabled for this file only.
 */
// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_fopen, WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fclose

class TeamGraph_CSV {

	/**
	 * Column order for export and the template. Import is header-driven, so
	 * files may omit columns or add unknown ones (ignored).
	 */
	const COLUMNS = array( 'name', 'job_title', 'email', 'phone', 'link_url', 'department', 'location', 'manager', 'bio' );

	/**
	 * Hard cap on import rows; keeps a runaway upload from exhausting the
	 * request.
	 */
	const MAX_ROWS = 5000;

	/* ---------------------------------------------------------------------
	 * Export
	 * ------------------------------------------------------------------- */

	/**
	 * All members as CSV.
	 *
	 * @return array{filename: string, content: string}
	 */
	public static function export() {
		$members = TeamGraph_Data::all_members();
		$titles  = array();
		foreach ( $members as $post ) {
			$titles[ $post->ID ] = $post->post_title;
		}

		$rows = array( self::COLUMNS );
		foreach ( $members as $post ) {
			$dept     = TeamGraph_Data::get_own_department( $post->ID );
			$location = TeamGraph_Data::get_own_location( $post->ID );
			$rows[]   = array(
				$post->post_title,
				(string) get_post_meta( $post->ID, '_teamgraph_job_title', true ),
				(string) get_post_meta( $post->ID, '_teamgraph_email', true ),
				(string) get_post_meta( $post->ID, '_teamgraph_phone', true ),
				(string) get_post_meta( $post->ID, '_teamgraph_link_url', true ),
				$dept ? $dept->name : '',
				$location ? $location->name : '',
				isset( $titles[ $post->post_parent ] ) ? $titles[ $post->post_parent ] : '',
				$post->post_content,
			);
		}

		$handle = fopen( 'php://temp', 'r+' );
		foreach ( $rows as $row ) {
			fputcsv( $handle, array_map( array( __CLASS__, 'guard_formula' ), $row ) );
		}
		rewind( $handle );
		$content = stream_get_contents( $handle );
		fclose( $handle );

		return array(
			'filename' => 'teamgraph-members-' . gmdate( 'Y-m-d' ) . '.csv',
			'content'  => $content,
		);
	}

	/**
	 * Neutralize spreadsheet formula injection on export: a cell that a
	 * spreadsheet would treat as a formula (leading =, +, -, @, or a
	 * tab/carriage return) is prefixed with a single quote so it is shown as
	 * literal text. Import strips this again by treating it as plain text.
	 */
	private static function guard_formula( $value ) {
		$value = (string) $value;
		if ( '' !== $value && preg_match( '/^[=\-+@\t\r]/', $value ) ) {
			return "'" . $value;
		}
		return $value;
	}

	/* ---------------------------------------------------------------------
	 * Import
	 * ------------------------------------------------------------------- */

	/**
	 * Import members from CSV text.
	 *
	 * Pass 1 creates or updates each row (matched to an existing member by
	 * exact name, case-insensitively). Pass 2 sets managers, so a report can
	 * appear before their manager in the file. Unresolvable rows are skipped
	 * with a warning rather than failing the whole import.
	 *
	 * @param string $csv Raw CSV text including a header row.
	 * @return array{created: int, updated: int, skipped: int, warnings: string[]}|WP_Error
	 */
	public static function import( $csv ) {
		$rows = self::parse( $csv );
		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		$created  = 0;
		$updated  = 0;
		$skipped  = 0;
		$warnings = array();

		// Existing members by lowercased name, for matching and manager lookup.
		$by_name = array();
		foreach ( TeamGraph_Data::all_members() as $post ) {
			$key = mb_strtolower( $post->post_title );
			if ( ! isset( $by_name[ $key ] ) ) {
				$by_name[ $key ] = $post->ID;
			}
		}

		$managers = array(); // post_id => manager name to resolve in pass 2.

		foreach ( $rows as $line => $row ) {
			$name = sanitize_text_field( $row['name'] ?? '' );
			if ( '' === $name ) {
				$skipped++;
				/* translators: %d: CSV line number. */
				$warnings[] = sprintf( __( 'Line %d: skipped — the name column is empty.', 'teamgraph' ), $line );
				continue;
			}

			$key      = mb_strtolower( $name );
			$existing = isset( $by_name[ $key ] ) ? (int) $by_name[ $key ] : 0;

			$postarr = array(
				'post_type'   => TeamGraph_Data::CPT,
				'post_status' => 'publish',
				'post_title'  => $name,
			);
			if ( $existing ) {
				$postarr['ID'] = $existing;
			}
			if ( array_key_exists( 'bio', $row ) ) {
				$postarr['post_content'] = wp_kses_post( $row['bio'] );
			}

			$result = $existing ? wp_update_post( $postarr, true ) : wp_insert_post( $postarr, true );
			if ( is_wp_error( $result ) ) {
				$skipped++;
				/* translators: 1: CSV line number, 2: error message. */
				$warnings[] = sprintf( __( 'Line %1$d: skipped — %2$s', 'teamgraph' ), $line, $result->get_error_message() );
				continue;
			}
			$post_id           = (int) $result;
			$by_name[ $key ]   = $post_id;
			$existing ? $updated++ : $created++;

			foreach ( TeamGraph_Data::field_map() as $field => $spec ) {
				if ( 'group' === $field || ! array_key_exists( $field, $row ) ) {
					continue;
				}
				update_post_meta( $post_id, $spec['meta_key'], TeamGraph_Data::sanitize_field_value( $row[ $field ], $spec['sanitize'] ) );
			}

			foreach ( array(
				'department' => TeamGraph_Data::TAXONOMY,
				'location'   => TeamGraph_Data::LOCATION,
			) as $column => $taxonomy ) {
				if ( ! array_key_exists( $column, $row ) ) {
					continue;
				}
				$term_name = sanitize_text_field( $row[ $column ] );
				if ( '' === $term_name ) {
					wp_set_object_terms( $post_id, array(), $taxonomy );
					continue;
				}
				$term = get_term_by( 'name', $term_name, $taxonomy );
				if ( ! $term ) {
					$inserted = wp_insert_term( $term_name, $taxonomy );
					if ( is_wp_error( $inserted ) ) {
						/* translators: 1: CSV line number, 2: term name. */
						$warnings[] = sprintf( __( 'Line %1$d: could not create the term "%2$s".', 'teamgraph' ), $line, $term_name );
						continue;
					}
					$term_id = (int) $inserted['term_id'];
				} else {
					$term_id = (int) $term->term_id;
				}
				wp_set_object_terms( $post_id, array( $term_id ), $taxonomy );
			}

			if ( array_key_exists( 'manager', $row ) ) {
				$managers[ $post_id ] = array( sanitize_text_field( $row['manager'] ), $line );
			}
		}

		// Pass 2: managers, now that every imported member exists.
		foreach ( $managers as $post_id => $entry ) {
			list( $manager_name, $line ) = $entry;
			$parent                      = 0;
			if ( '' !== $manager_name ) {
				$manager_key = mb_strtolower( $manager_name );
				if ( ! isset( $by_name[ $manager_key ] ) ) {
					/* translators: 1: CSV line number, 2: manager name. */
					$warnings[] = sprintf( __( 'Line %1$d: manager "%2$s" was not found — the member was left without a manager.', 'teamgraph' ), $line, $manager_name );
				} elseif ( TeamGraph_Data::creates_cycle( $post_id, $by_name[ $manager_key ] ) ) {
					/* translators: 1: CSV line number, 2: manager name. */
					$warnings[] = sprintf( __( 'Line %1$d: manager "%2$s" would create a reporting cycle — the member was left without a manager.', 'teamgraph' ), $line, $manager_name );
				} else {
					$parent = (int) $by_name[ $manager_key ];
				}
			}
			wp_update_post(
				array(
					'ID'          => $post_id,
					'post_parent' => $parent,
				)
			);
		}

		return array(
			'created'  => $created,
			'updated'  => $updated,
			'skipped'  => $skipped,
			'warnings' => $warnings,
		);
	}

	/**
	 * Parse CSV text into associative rows keyed by the (case-insensitive)
	 * header. Unknown columns are dropped. Returns rows keyed by their
	 * 1-based CSV line number.
	 *
	 * @return array<int, array<string, string>>|WP_Error
	 */
	private static function parse( $csv ) {
		$csv = str_replace( "\xEF\xBB\xBF", '', (string) $csv ); // Strip a UTF-8 BOM (Excel adds one).
		if ( '' === trim( $csv ) ) {
			return new WP_Error( 'teamgraph_csv_empty', __( 'The CSV file is empty.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$handle = fopen( 'php://temp', 'r+' );
		fwrite( $handle, $csv );
		rewind( $handle );

		$header = fgetcsv( $handle );
		if ( ! $header ) {
			fclose( $handle );
			return new WP_Error( 'teamgraph_csv_empty', __( 'The CSV file is empty.', 'teamgraph' ), array( 'status' => 400 ) );
		}
		$header = array_map(
			function ( $column ) {
				return strtolower( trim( (string) $column ) );
			},
			$header
		);
		if ( ! in_array( 'name', $header, true ) ) {
			fclose( $handle );
			return new WP_Error( 'teamgraph_csv_no_name', __( 'The CSV file needs a "name" column in its header row.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$rows = array();
		$line = 1;
		while ( ( $fields = fgetcsv( $handle ) ) !== false ) {
			$line++;
			if ( array( null ) === $fields ) {
				continue; // Blank line.
			}
			if ( count( $rows ) >= self::MAX_ROWS ) {
				fclose( $handle );
				/* translators: %d: maximum row count. */
				return new WP_Error( 'teamgraph_csv_too_big', sprintf( __( 'The CSV file has too many rows (the limit is %d).', 'teamgraph' ), self::MAX_ROWS ), array( 'status' => 400 ) );
			}
			$row = array();
			foreach ( $header as $index => $column ) {
				if ( in_array( $column, self::COLUMNS, true ) ) {
					$row[ $column ] = isset( $fields[ $index ] ) ? (string) $fields[ $index ] : '';
				}
			}
			$rows[ $line ] = $row;
		}
		fclose( $handle );

		return $rows;
	}
}
// phpcs:enable WordPress.WP.AlternativeFunctions.file_system_operations_fopen, WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fclose
