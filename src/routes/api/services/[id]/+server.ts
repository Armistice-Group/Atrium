import { error, json } from '@sveltejs/kit';
import { adminBody } from '#lib/server/api.ts';
import { config } from '#lib/server/config.ts';
import { updateStore } from '#lib/server/store.ts';
import type { ServiceEdit } from '#lib/types.ts';
import type { RequestHandler } from './$types';

/** Saves a tile's edits. Empty fields fall back to Pangolin's or services.yaml's values. */
export const PUT: RequestHandler = async (event) => {
	const o = ((await adminBody(event)) ?? {}) as Record<string, unknown>;
	const str = (k: string, max: number) => {
		const v = typeof o[k] === 'string' ? (o[k] as string).trim() : '';
		if (v.length > max) error(400, `Keep the ${k} under ${max} characters.`);
		return v || undefined;
	};
	const edit: ServiceEdit & { label?: string } = {
		name: str('name', 80),
		icon: str('icon', 2000),
		group: str('group', 60),
		description: str('description', 200),
		hidden: o.hidden === true || undefined,
		wide: o.wide === true || undefined,
		// The tile's name when it was hidden, so Settings can list it.
		label: str('label', 80)
	};
	if (edit.icon && /^[a-z][a-z0-9+.-]*:/i.test(edit.icon) && !/^https?:\/\//i.test(edit.icon)) error(400, 'An icon URL needs to start with http:// or https://');
	const empty = !edit.name && !edit.icon && !edit.group && !edit.description && !edit.hidden && !edit.wide;
	await updateStore(config.dataDir, (s) => {
		if (empty) delete s.edits[event.params.id];
		else s.edits[event.params.id] = JSON.parse(JSON.stringify(edit));
	});
	return json({ ok: true });
};

/** Back to how Pangolin and services.yaml have it. */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.admin) error(403, 'Only the people in HUB_ADMINS can change settings.');
	await updateStore(config.dataDir, (s) => void delete s.edits[event.params.id]);
	return json({ ok: true });
};
