/**
 * Extends @wordpress/scripts default config with our entries: one bundle for
 * all admin screens (apps mount based on the root element's data-page
 * attribute) and one for the block editor.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		admin: './src/admin/index.js',
		block: './src/block/index.js',
	},
};
