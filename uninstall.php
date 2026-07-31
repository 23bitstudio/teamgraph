<?php
/**
 * Uninstall cleanup. Removes all TeamGraph data, but only when the site owner
 * opted in via TeamGraph → Settings → "Delete all data on uninstall".
 * Deleting the plugin without that setting keeps every member intact.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$teamgraph_settings = get_option( 'teamgraph_settings', array() );
if ( empty( $teamgraph_settings['delete_on_uninstall'] ) ) {
	return;
}

// Members (all statuses, meta and thumbnails follow the posts).
$teamgraph_members = get_posts(
	array(
		'post_type'      => 'teamgraph_member',
		'post_status'    => 'any',
		'fields'         => 'ids',
		'posts_per_page' => -1,
	)
);
foreach ( $teamgraph_members as $teamgraph_member_id ) {
	wp_delete_post( $teamgraph_member_id, true );
}

// Departments and locations. The taxonomies aren't registered during
// uninstall, so register bare stand-ins first to let the term API work.
foreach ( array( 'teamgraph_department', 'teamgraph_location' ) as $teamgraph_taxonomy ) {
	register_taxonomy( $teamgraph_taxonomy, 'teamgraph_member' );
	$teamgraph_terms = get_terms(
		array(
			'taxonomy'   => $teamgraph_taxonomy,
			'hide_empty' => false,
			'fields'     => 'ids',
		)
	);
	if ( ! is_wp_error( $teamgraph_terms ) ) {
		foreach ( $teamgraph_terms as $teamgraph_term_id ) {
			wp_delete_term( $teamgraph_term_id, $teamgraph_taxonomy );
		}
	}
}

delete_option( 'teamgraph_groups' );
delete_option( 'teamgraph_settings' );
