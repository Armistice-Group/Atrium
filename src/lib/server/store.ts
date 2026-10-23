import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServiceEdit } from '#lib/types.ts';

/** A Pangolin Integration API the hub reads resources from. */
export interface Connection {
	id: string;
	name: string;
	/** Base URL ending in /v1, e.g. https://api.pangolin.net/v1 */
	url: string;
	key: string;
	org: string;
	enabled: boolean;
}

/** What the UI saves: hub.json in the data directory. */
export interface Store {
	connections: Connection[];
	/** Tile edits by service id. */
	edits: Record<string, ServiceEdit & { label?: string }>;
	groups: {
		/** Order set in Settings; when empty, services.yaml's `groups:` decides. */
		order: string[];
		/** Renamed groups: lower-cased old name → new name. */
		renames: Record<string, string>;
	};
}

const EMPTY = (): Store => ({ connections: [], edits: {}, groups: { order: [], renames: {} } });

let cached: { dir: string; store: Store } | null = null;
/** Writes run one at a time, so two quick saves can't interleave. */
let queue: Promise<unknown> = Promise.resolve();

export async function readStore(dir: string): Promise<Store> {
	if (cached?.dir === dir) return cached.store;
	let store = EMPTY();
	try {
		const raw = JSON.parse(await readFile(join(dir, 'hub.json'), 'utf8')) as Partial<Store>;
		const groups = (raw.groups ?? {}) as Partial<Store['groups']>;
		store = {
			connections: Array.isArray(raw.connections) ? raw.connections : [],
			edits: raw.edits && typeof raw.edits === 'object' ? raw.edits : {},
			groups: { order: Array.isArray(groups.order) ? groups.order : [], renames: groups.renames && typeof groups.renames === 'object' ? groups.renames : {} }
		};
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Couldn’t read ${join(dir, 'hub.json')}: ${(err as Error).message}`);
	}
	cached = { dir, store };
	return store;
}

/** Applies `change` and saves atomically (write, then rename), readable only by the hub: it holds API keys. */
export function updateStore<T>(dir: string, change: (s: Store) => T): Promise<T> {
	const run = queue.then(async () => {
		const store = structuredClone(await readStore(dir));
		const result = change(store);
		await mkdir(dir, { recursive: true });
		const tmp = join(dir, `.hub.json.${process.pid}.tmp`);
		await writeFile(tmp, JSON.stringify(store, null, '\t') + '\n', { mode: 0o600 });
		await rename(tmp, join(dir, 'hub.json'));
		cached = { dir, store };
		return result;
	});
	queue = run.catch(() => {});
	return run;
}

export const newId = () => randomUUID().slice(0, 8);

/** Tests use a fresh directory each time. */
export function forgetStore() {
	cached = null;
}
