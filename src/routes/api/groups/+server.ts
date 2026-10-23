import { error, json } from '@sveltejs/kit';
import { adminBody } from '#lib/server/api.ts';
import { config } from '#lib/server/config.ts';
import { renameGroup } from '#lib/server/groups.ts';
import { updateStore } from '#lib/server/store.ts';
import type { RequestHandler } from './$types';

/** Saves the order of groups; an empty list goes back to services.yaml's order. */
export const PUT: RequestHandler = async (event) => {
	const { order } = ((await adminBody(event)) ?? {}) as { order?: unknown };
	if (!Array.isArray(order) || !order.every((g) => typeof g === 'string')) error(400, 'Send the groups in order.');
	await updateStore(config.dataDir, (s) => void (s.groups.order = [...new Set(order.map((g) => g.trim()).filter(Boolean))]));
	return json({ ok: true });
};

/** Renames a group, or removes it (`to` empty): its tiles then move to the default group. */
export const POST: RequestHandler = async (event) => {
	const o = ((await adminBody(event)) ?? {}) as Record<string, unknown>;
	const from = typeof o.from === 'string' ? o.from.trim() : '';
	const to = (typeof o.to === 'string' ? o.to.trim() : '') || config.defaultGroup;
	if (!from) error(400, 'Which group?');
	if (to.length > 60) error(400, 'Keep the name under 60 characters.');
	if (from.toLowerCase() === config.defaultGroup.toLowerCase() && !o.to) error(400, `${config.defaultGroup} is where ungrouped tiles go, so it can’t be removed. Rename it instead.`);
	await updateStore(config.dataDir, (s) => renameGroup(s, from, to));
	return json({ ok: true });
};
