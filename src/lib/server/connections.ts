import type { Viewer } from '#lib/types.ts';
import type { Config } from './config.ts';
import { isWebResource, listResources } from './pangolin.ts';
import { readStore, type Connection } from './store.ts';

export type Source = Connection & { source: 'env' | 'ui' };

/** The PANGOLIN_* connection (if set) first, then the ones added in the UI. */
export async function allConnections(cfg: Config): Promise<Source[]> {
	const out: Source[] = [];
	if (cfg.pangolinUrl && cfg.pangolinKey) {
		out.push({ id: 'env', name: 'From environment', url: cfg.pangolinUrl, key: cfg.pangolinKey, org: cfg.pangolinOrg, enabled: true, source: 'env' });
	}
	const { connections } = await readStore(cfg.dataDir);
	return [...out, ...connections.map((c) => ({ ...c, source: 'ui' as const }))];
}

/** Without HUB_ADMINS, anyone Pangolin lets in can change settings. */
export function isAdmin(viewer: Viewer | null, cfg: Config): boolean {
	if (!cfg.admins.length) return true;
	if (!viewer) return false;
	return [viewer.email, viewer.username].some((v) => v && cfg.admins.includes(v.toLowerCase()));
}

export interface ConnectionInput {
	name: string;
	url: string;
	/** Empty when editing means "keep the saved key". */
	key: string;
	org: string;
	enabled: boolean;
}

/** Checks a form from the settings page; returns the cleaned values or a message for the user. */
export function parseConnection(body: unknown): { input: ConnectionInput } | { error: string } {
	const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
	const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');
	const input: ConnectionInput = { name: str('name'), url: str('url').replace(/\/+$/, ''), key: str('key'), org: str('org'), enabled: o.enabled !== false };
	if (!input.url) return { error: 'Enter the API URL.' };
	let url: URL;
	try {
		url = new URL(input.url);
	} catch {
		return { error: 'The API URL isn’t a valid URL.' };
	}
	if (!/^https?:$/.test(url.protocol)) return { error: 'The API URL needs to start with http:// or https://' };
	if (!input.name) input.name = url.hostname;
	if (input.name.length > 60) return { error: 'Keep the name under 60 characters.' };
	return { input };
}

/** Asks Pangolin for the resources with these settings, without saving them. */
export async function testConnection(c: { url: string; key: string; org: string }, f: typeof fetch = fetch): Promise<{ ok: true; count: number; total: number } | { ok: false; error: string }> {
	try {
		const resources = await listResources(c.url, c.key, c.org, f);
		return { ok: true, count: resources.filter(isWebResource).length, total: resources.length };
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
}
