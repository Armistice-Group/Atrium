import { error, json } from '@sveltejs/kit';
import { adminBody } from '#lib/server/api.ts';
import { config } from '#lib/server/config.ts';
import { parseConnection } from '#lib/server/connections.ts';
import { newId, updateStore } from '#lib/server/store.ts';
import type { RequestHandler } from './$types';

/** Adds a connection. */
export const POST: RequestHandler = async (event) => {
	const parsed = parseConnection(await adminBody(event));
	if ('error' in parsed) error(400, parsed.error);
	if (!parsed.input.key) error(400, 'Paste the API key.');
	const id = await updateStore(config.dataDir, (s) => {
		const id = newId();
		s.connections.push({ id, ...parsed.input });
		return id;
	});
	return json({ id });
};
