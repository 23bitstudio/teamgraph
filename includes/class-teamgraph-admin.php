<?php
/**
 * Admin: registers the custom screens and mounts the React bundle on each.
 * The bundle decides which app to render from the root element's data-page
 * attribute.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class TeamGraph_Admin {

	const MENU_SLUG = 'teamgraph-members';

	/**
	 * Registered admin screens, keyed by admin page slug. Each entry:
	 * array(
	 *   'page'  => string  data-page value the React bundle mounts on,
	 *   'title' => string  menu label,
	 *   'cap'   => string  capability required,
	 * )
	 *
	 * Extensions append screens via the filter; core prints the shared mount
	 * element for every registered slug, and a bundle that recognizes the
	 * data-page value renders there (core's bundle ignores pages it doesn't
	 * know, so extension bundles can claim them).
	 */
	public static function pages() {
		return apply_filters(
			'teamgraph_admin_pages',
			array(
				'teamgraph-members' => array(
					'page'  => 'members',
					'title' => __( 'Team Members', 'teamgraph' ),
					'cap'   => 'edit_others_posts',
				),
				'teamgraph-add'     => array(
					'page'  => 'member-form',
					'title' => __( 'Add Member', 'teamgraph' ),
					'cap'   => 'edit_others_posts',
					'hidden' => true,
				),
				'teamgraph-builder' => array(
					'page'  => 'builder',
					'title' => __( 'Chart Builder', 'teamgraph' ),
					'cap'   => 'edit_others_posts',
				),
				'teamgraph-organization' => array(
					'page'  => 'organization',
					'title' => __( 'Organization', 'teamgraph' ),
					'cap'   => 'manage_options',
				),
				'teamgraph-theme'   => array(
					'page'  => 'theme',
					'title' => __( 'Theme', 'teamgraph' ),
					'cap'   => 'manage_options',
				),
				'teamgraph-settings' => array(
					'page'  => 'settings',
					'title' => __( 'Settings', 'teamgraph' ),
					'cap'   => 'manage_options',
				),
			)
		);
	}

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
	}

	public static function menu() {
		add_menu_page(
			__( 'TeamGraph', 'teamgraph' ),
			__( 'TeamGraph', 'teamgraph' ),
			'edit_others_posts',
			self::MENU_SLUG,
			array( __CLASS__, 'render' ),
			'dashicons-networking',
			26
		);
		/*
		 * Hidden screens stay registered as real submenu entries under the
		 * TeamGraph parent — that keeps core's access check passing and its
		 * parent detection working, so the TeamGraph menu stays open while
		 * on them. They are hidden from display with CSS (hide_menu_items):
		 * remove_submenu_page() would deny access, and a parentless page
		 * would collapse the menu, because core re-derives both the page's
		 * hookname and the open menu from the submenu array at request time.
		 */
		foreach ( self::pages() as $slug => $screen ) {
			add_submenu_page( self::MENU_SLUG, $screen['title'], $screen['title'], $screen['cap'], $slug, array( __CLASS__, 'render' ) );
		}

		add_filter( 'submenu_file', array( __CLASS__, 'highlight_submenu' ) );
		add_action( 'admin_head', array( __CLASS__, 'hide_menu_items' ) );
	}

	/**
	 * On a hidden screen, highlight Team Members instead of the (invisible)
	 * current submenu entry.
	 */
	public static function highlight_submenu( $submenu_file ) {
		global $plugin_page;
		$pages = self::pages();
		if ( $plugin_page && ! empty( $pages[ $plugin_page ]['hidden'] ) ) {
			return self::MENU_SLUG;
		}
		return $submenu_file;
	}

	/**
	 * Hide the menu entries of hidden screens on every admin page (the menu
	 * is global, so this can't be limited to TeamGraph screens).
	 */
	public static function hide_menu_items() {
		$selectors = array();
		foreach ( self::pages() as $slug => $screen ) {
			if ( ! empty( $screen['hidden'] ) ) {
				$selectors[] = sprintf( '#adminmenu li:has(> a[href$="page=%1$s"]), #adminmenu a[href$="page=%1$s"]', esc_attr( $slug ) );
			}
		}
		if ( $selectors ) {
			// $selectors is CSS built from esc_attr()'d, known plugin page slugs
			// (see above). It is emitted inside a <style> tag, where esc_html()
			// would corrupt the selector syntax (e.g. the child combinator), and
			// no CSS-context escaper exists in core.
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CSS selectors from esc_attr()'d plugin slugs.
			printf( '<style>%s{display:none;}</style>' . "\n", implode( ',', $selectors ) );
		}
	}

	public static function render() {
		$pages = self::pages();
		$slug  = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : self::MENU_SLUG; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page  = isset( $pages[ $slug ] ) ? $pages[ $slug ]['page'] : 'members';
		printf( '<div id="teamgraph-admin-root" data-page="%s"></div>', esc_attr( $page ) );
	}

	public static function enqueue( $hook ) {
		$slug = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( self::pages()[ $slug ] ) ) {
			return;
		}

		$asset_file = TEAMGRAPH_PATH . 'build/admin.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_enqueue_media(); // Photo picker uses the media library modal.

		wp_enqueue_script(
			'teamgraph-admin',
			TEAMGRAPH_URL . 'build/admin.js',
			array_merge( $asset['dependencies'], array( 'media-editor' ) ),
			$asset['version'],
			true
		);

		wp_set_script_translations( 'teamgraph-admin', 'teamgraph', TEAMGRAPH_PATH . 'languages' );

		if ( file_exists( TEAMGRAPH_PATH . 'build/style-admin.css' ) ) {
			wp_enqueue_style( 'teamgraph-admin', TEAMGRAPH_URL . 'build/style-admin.css', array(), $asset['version'] );
		}

		$page_urls = array(
			'members' => admin_url( 'admin.php?page=teamgraph-members' ),
			'add'     => admin_url( 'admin.php?page=teamgraph-add' ),
			'builder' => admin_url( 'admin.php?page=teamgraph-builder' ),
		);
		foreach ( self::pages() as $page_slug => $screen ) {
			if ( ! isset( $page_urls[ $screen['page'] ] ) ) {
				$page_urls[ $screen['page'] ] = admin_url( 'admin.php?page=' . $page_slug );
			}
		}

		wp_localize_script(
			'teamgraph-admin',
			'TEAMGRAPH_ADMIN',
			/**
			 * Filter the data handed to admin bundles. Extension bundles read
			 * the same global, so this is the place to add REST URLs or
			 * feature flags for extra screens.
			 */
			apply_filters(
				'teamgraph_admin_data',
				array(
					'restUrl'     => esc_url_raw( rest_url( TeamGraph_Rest::NS ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'canSettings' => current_user_can( 'manage_options' ),
					'pages'       => $page_urls,
				)
			)
		);
	}
}
