import { error } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { allConnections } from '#lib/server/connections.ts';
import { buildHub, connectionStatus } from '#lib/server/hub.ts';
import { readStore } from '#lib/server/store.ts';
import type { ConnectionView } from '#lib/types.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	if (!locals.admin) error(403, 'Only the people in HUB_ADMINS can open Settings.');
	depends('hub:settings');
	// Asks each connection once, so their status is current.
	const hub = await buildHub();
	const connections: ConnectionView[] = (await allConnections(config)).map((c) => ({
		id: c.id,
		name: c.name,
		url: c.url,
		org: c.org,
		enabled: c.enabled,
		keyHint: c.key.slice(-4),
		source: c.source,
		status: c.enabled ? connectionStatus(c.id) : null
	}));
	const { edits, groups: groupSettings } = await readStore(config.dataDir);
	const groups = hub.groups.map((name) => ({ name, count: hub.services.filter((s) => s.group === name).length }));
	const hidden = Object.entries(edits)
		.filter(([, e]) => e.hidden)
		.map(([id, e]) => ({ id, name: e.label || e.name || id, edit: e }));
	return {
		connections,
		hidden,
		groups,
		customOrder: groupSettings.order.length > 0,
		defaultGroup: config.defaultGroup,
		title: config.title,
		adminsSet: config.admins.length > 0
	};
};
