<?php
/**
 * Plugin Name: TeamGraph – Org Chart & Team Directory
 * Plugin URI:  https://getteamgraph.com
 * Description: Accessible org charts and team directories: chart, grid, and list views from one block or shortcode, built as semantic HTML. Drag-and-drop React admin; dependency-free front end.
 * Version:     1.0.0
 * Author:      23Bit Studio
 * Author URI:  https://23bitstudio.com
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * License:     GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: teamgraph
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'TEAMGRAPH_VERSION', '1.0.0' );
define( 'TEAMGRAPH_PATH', plugin_dir_path( __FILE__ ) );
define( 'TEAMGRAPH_URL', plugin_dir_url( __FILE__ ) );

require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-data.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-groups.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-rest.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-admin.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-settings.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-demo.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-csv.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-shortcode.php';
require_once TEAMGRAPH_PATH . 'includes/class-teamgraph-block.php';

TeamGraph_Data::init();
TeamGraph_Rest::init();
TeamGraph_Admin::init();
TeamGraph_Shortcode::init();
TeamGraph_Block::init();

register_activation_hook( __FILE__, 'teamgraph_activate' );

function teamgraph_activate() {
	TeamGraph_Data::register();
	flush_rewrite_rules();
}
