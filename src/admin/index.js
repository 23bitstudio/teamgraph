/**
 * Admin entry: one bundle for all core screens. The PHP side prints
 * <div id="teamgraph-admin-root" data-page="…"> and this picks the app.
 *
 * Extensibility: mounting waits for DOMContentLoaded so extension bundles
 * enqueued after this one can register first. They can either add whole
 * screens to the router via the `teamgraph.adminPages` filter (paired with the
 * PHP `teamgraph_admin_pages` filter) or claim an unknown data-page value by
 * mounting into the root element themselves — this bundle only renders pages
 * it recognizes.
 */

import { createRoot } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import Members from './pages/Members';
import MemberForm from './pages/MemberForm';
import Builder from './pages/Builder';
import Organization from './pages/Organization';
import Theme from './pages/Theme';
import Settings from './pages/Settings';
import { ToastHost } from './toast';
import './style.scss';

const CORE_APPS = {
	members: Members,
	'member-form': MemberForm,
	builder: Builder,
	organization: Organization,
	theme: Theme,
	settings: Settings,
};

function mount() {
	const root = document.getElementById( 'teamgraph-admin-root' );
	if ( ! root ) {
		return;
	}
	const apps = applyFilters( 'teamgraph.adminPages', CORE_APPS );
	const App = apps[ root.dataset.page ];
	if ( App ) {
		createRoot( root ).render(
			<>
				<App />
				<ToastHost />
			</>
		);
	}
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mount );
} else {
	mount();
}
