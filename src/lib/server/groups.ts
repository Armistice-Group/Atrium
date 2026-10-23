import type { Store } from './store.ts';

const key = (s: string) => s.trim().toLowerCase();

/**
 * Renames a group as the page shows it. Earlier renames that led to `from`, tile edits that put a
 * tile in it, and its place in the order all follow, so the group keeps its tiles and position.
 */
export function renameGroup(s: Store, from: string, to: string) {
	const { renames, order } = s.groups;
	for (const [k, v] of Object.entries(renames)) if (key(v) === key(from)) renames[k] = to;
	renames[key(from)] = to;
	for (const [k, v] of Object.entries(renames)) if (k === key(v)) delete renames[k];
	for (const e of Object.values(s.edits)) if (e.group && key(e.group) === key(from)) e.group = to;
	const at = order.findIndex((g) => key(g) === key(from));
	if (at !== -1) {
		const dupe = order.findIndex((g, i) => i !== at && key(g) === key(to));
		order[at] = to;
		// Merged into a group that already had a place: keep the earlier one.
		if (dupe !== -1) order.splice(Math.max(at, dupe), 1);
	}
}
