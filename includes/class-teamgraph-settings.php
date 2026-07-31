<?php
/**
 * Plugin settings, stored in one option. Only keys declared in DEFAULTS are
 * accepted; everything is cast to the default's type.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Settings {

	const OPTION = 'teamgraph_settings';

	const DEFAULTS = array(
		'delete_on_uninstall' => false,
	);

	public static function get() {
		$stored = get_option( self::OPTION, array() );
		return wp_parse_args( is_array( $stored ) ? $stored : array(), self::DEFAULTS );
	}

	public static function save( $input ) {
		if ( ! is_array( $input ) ) {
			return new WP_Error( 'teamgraph_invalid', __( 'Settings payload must be an object.', 'teamgraph' ), array( 'status' => 400 ) );
		}
		$clean = self::get();
		foreach ( self::DEFAULTS as $key => $default ) {
			if ( array_key_exists( $key, $input ) ) {
				$clean[ $key ] = is_bool( $default ) ? rest_sanitize_boolean( $input[ $key ] ) : sanitize_text_field( $input[ $key ] );
			}
		}
		update_option( self::OPTION, $clean, false );
		return $clean;
	}
}
