import { error, json } from '@sveltejs/kit';
import { adminBody } from '#lib/server/api.ts';
import { config } from '#lib/server/config.ts';
import { parseConnection } from '#lib/server/connections.ts';
import { resetCache } from '#lib/server/hub.ts';
import { updateStore } from '#lib/server/store.ts';
import type { RequestHandler } from './$types';

const ENV = 'This one comes from PANGOLIN_* in compose.yaml: change or remove it there.';

/** Edits a connection; an empty key keeps the saved one. */
export const PUT: RequestHandler = async (event) => {
	if (event.params.id === 'env') error(400, ENV);
	const parsed = parseConnection(await adminBody(event));
	if ('error' in parsed) error(400, parsed.error);
	const found = await updateStore(config.dataDir, (s) => {
		const c = s.connections.find((c) => c.id === event.params.id);
		if (!c) return false;
		Object.assign(c, { ...parsed.input, key: parsed.input.key || c.key });
		return true;
	});
	if (!found) error(404, 'That connection no longer exists.');
	resetCache(event.params.id);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	if (event.params.id === 'env') error(400, ENV);
	if (!event.locals.admin) error(403, 'Only the people in HUB_ADMINS can change settings.');
	await updateStore(config.dataDir, (s) => {
		s.connections = s.connections.filter((c) => c.id !== event.params.id);
		// Edits to its tiles would never match again.
		for (const id of Object.keys(s.edits)) if (id.startsWith(`p-${event.params.id}-`)) delete s.edits[id];
	});
	resetCache(event.params.id);
	return json({ ok: true });
};
