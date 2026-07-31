<?php
/**
 * The teamgraph/chart Gutenberg block. Dynamic: attributes map onto the same
 * render path as the [teamgraph] shortcode, so block and shortcode output are
 * always identical.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Block {

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
	}

	public static function register() {
		$asset_file = TEAMGRAPH_PATH . 'build/block.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return; // Not built yet.
		}
		$asset = require $asset_file;

		wp_register_script(
			'teamgraph-block',
			TEAMGRAPH_URL . 'build/block.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_set_script_translations( 'teamgraph-block', 'teamgraph', TEAMGRAPH_PATH . 'languages' );

		register_block_type(
			TEAMGRAPH_PATH . 'block',
			array(
				'render_callback' => array( __CLASS__, 'render' ),
			)
		);
	}

	public static function render( $attributes ) {
		return TeamGraph_Shortcode::render(
			array(
				'view'       => isset( $attributes['view'] ) ? $attributes['view'] : 'tree',
				'root'       => isset( $attributes['root'] ) ? (int) $attributes['root'] : 0,
				'department' => isset( $attributes['department'] ) ? (int) $attributes['department'] : 0,
				'location'   => isset( $attributes['location'] ) ? (int) $attributes['location'] : 0,
				'showtools'  => ! empty( $attributes['showTools'] ) ? 'true' : '',
				// Always explicit: the block's `view` attribute is never
				// absent, so the shortcode's "author pinned a view" inference
				// can't apply here.
				'viewswitch' => ! empty( $attributes['showViewSwitch'] ) ? 'true' : 'false',
			)
		);
	}
}
