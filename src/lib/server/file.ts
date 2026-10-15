import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

/** One entry in services.yaml: an extra link (has `url`), or an override for a Pangolin service (has `match`). */
export interface FileEntry {
	match?: string;
	name?: string;
	url?: string;
	group?: string;
	icon?: string;
	description?: string;
	hidden?: boolean;
}

export interface ServicesFile {
	groups: string[];
	entries: FileEntry[];
}

const EMPTY: ServicesFile = { groups: [], entries: [] };

/** A missing file is fine; a broken one is reported rather than silently ignored. */
export async function readServicesFile(path: string): Promise<{ file: ServicesFile; error: string | null }> {
	let text: string;
	try {
		text = await readFile(path, 'utf8');
	} catch (err) {
		// Missing, or a directory Docker made because the bind-mounted file didn't exist yet: no extras.
		if (['ENOENT', 'EISDIR'].includes((err as NodeJS.ErrnoException).code ?? '')) return { file: EMPTY, error: null };
		return { file: EMPTY, error: `Couldn’t read ${path}: ${(err as Error).message}` };
	}
	return parseServicesFile(text, path);
}

export function parseServicesFile(text: string, path = 'services.yaml'): { file: ServicesFile; error: string | null } {
	let doc: unknown;
	try {
		doc = parse(text) ?? {};
	} catch (err) {
		return { file: EMPTY, error: `${path} isn’t valid YAML: ${(err as Error).message.split('\n')[0]}` };
	}
	const root = (Array.isArray(doc) ? { services: doc } : doc) as { groups?: unknown; services?: unknown };
	const groups = Array.isArray(root.groups) ? root.groups.filter((g): g is string => typeof g === 'string') : [];
	const raw = Array.isArray(root.services) ? root.services : [];
	const entries: FileEntry[] = [];
	for (const e of raw) {
		if (!e || typeof e !== 'object') continue;
		const o = e as Record<string, unknown>;
		const s = (k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim() : undefined);
		const entry: FileEntry = { match: s('match'), name: s('name'), url: s('url'), group: s('group'), icon: s('icon'), description: s('description'), hidden: o.hidden === true };
		if (entry.url && !/^https?:\/\//.test(entry.url)) return { file: EMPTY, error: `${path}: “${entry.url}” needs to start with http:// or https://` };
		if (entry.match || entry.url) entries.push(entry);
	}
	return { file: { groups, entries }, error: null };
}
