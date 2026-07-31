<?php
/**
 * Styling groups ("color guides"): admin-defined color schemes with up to
 * eight levels. Stored in a single option; validated server-side so only
 * clean hex colors ever reach the chart.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Groups {

	const OPTION     = 'teamgraph_groups';
	const MAX_LEVELS = 8;

	/**
	 * All guides keyed by id.
	 * Each: ['id','name','levels'=>[['bg','bg2','text','pill_bg','pill_text'],...]].
	 * bg2 is the optional gradient end color ('' = flat).
	 */
	public static function get_all() {
		$groups = get_option( self::OPTION, array() );
		if ( ! is_array( $groups ) ) {
			return array();
		}
		$keyed = array();
		foreach ( $groups as $group ) {
			if ( isset( $group['id'] ) ) {
				$keyed[ $group['id'] ] = $group;
			}
		}
		return $keyed;
	}

	/**
	 * Replace the whole set. Returns the sanitized guides (keyed by id) or
	 * WP_Error when a guide is malformed.
	 */
	public static function save_all( $groups ) {
		if ( ! is_array( $groups ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'Groups payload must be an array.', 'teamgraph' ), array( 'status' => 400 ) );
		}

		$clean = array();
		foreach ( $groups as $group ) {
			$id   = isset( $group['id'] ) ? sanitize_key( $group['id'] ) : '';
			$name = isset( $group['name'] ) ? sanitize_text_field( $group['name'] ) : '';
			if ( '' === $id || '' === $name ) {
				return new WP_Error( 'teamgraph_invalid', __( 'Every color guide needs an id and a name.', 'teamgraph' ), array( 'status' => 400 ) );
			}

			$levels = array();
			$raw    = ( isset( $group['levels'] ) && is_array( $group['levels'] ) ) ? array_values( $group['levels'] ) : array();
			foreach ( array_slice( $raw, 0, self::MAX_LEVELS ) as $level ) {
				$levels[] = array(
					'bg'        => self::clean_color( $level, 'bg', '#ffffff' ),
					'bg2'       => self::clean_color( $level, 'bg2', '' ), // '' = no gradient.
					'text'      => self::clean_color( $level, 'text', '#1e2430' ),
					'pill_bg'   => self::clean_color( $level, 'pill_bg', '#344563' ),
					'pill_text' => self::clean_color( $level, 'pill_text', '#ffffff' ),
				);
			}
			if ( empty( $levels ) ) {
				return new WP_Error( 'teamgraph_invalid', __( 'Every color guide needs at least one level.', 'teamgraph' ), array( 'status' => 400 ) );
			}

			$clean[] = array(
				'id'     => $id,
				'name'   => $name,
				'levels' => $levels,
			);
		}

		update_option( self::OPTION, $clean, false );
		return self::get_all();
	}

	/**
	 * A valid 3/6-digit hex color from $level[$key], or $fallback. An empty
	 * value stays empty only when the fallback allows it (gradient end).
	 */
	private static function clean_color( $level, $key, $fallback ) {
		$value = isset( $level[ $key ] ) ? trim( (string) $level[ $key ] ) : '';
		if ( '' === $value ) {
			return $fallback;
		}
		$hex = sanitize_hex_color( $value );
		return $hex ? $hex : $fallback;
	}
}
