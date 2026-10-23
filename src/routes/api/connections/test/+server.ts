import { error, json } from '@sveltejs/kit';
import { adminBody } from '#lib/server/api.ts';
import { config } from '#lib/server/config.ts';
import { allConnections, parseConnection, testConnection } from '#lib/server/connections.ts';
import type { RequestHandler } from './$types';

/** Tries the form's values before they're saved. A blank key on an existing connection uses the saved one. */
export const POST: RequestHandler = async (event) => {
	const body = (await adminBody(event)) as { id?: unknown };
	const parsed = parseConnection(body);
	if ('error' in parsed) error(400, parsed.error);
	let key = parsed.input.key;
	if (!key && typeof body.id === 'string') key = (await allConnections(config)).find((c) => c.id === body.id)?.key ?? '';
	if (!key) error(400, 'Paste the API key.');
	return json(await testConnection({ ...parsed.input, key }));
};
