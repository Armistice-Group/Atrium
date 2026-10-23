import type { Health } from '#lib/types.ts';

/** The parts of a Pangolin resource the hub uses. Older Pangolin versions omit some of them. */
export interface PangolinResource {
	resourceId: number;
	niceId?: string;
	name: string;
	fullDomain: string | null;
	ssl?: boolean;
	enabled?: boolean;
	wildcard?: boolean;
	/** "http", "tcp", "udp", "ssh"… (newer versions). */
	mode?: string | null;
	/** Older versions: true for HTTP resources. */
	http?: boolean;
	health?: string | null;
	/** One per site the targets are on; `online` is missing for the local site. */
	sites?: { siteId?: number; siteName?: string; online?: boolean }[];
	labels?: { name: string; color?: string }[];
}

type Fetch = typeof fetch;

export class PangolinError extends Error {}

/** Every resource in the org, following pagination (page/pageSize now, a single page on older versions). */
export async function listResources(base: string, key: string, orgId: string, f: Fetch = fetch): Promise<PangolinResource[]> {
	const org = orgId || (await firstOrg(base, key, f));
	const seen = new Map<number, PangolinResource>();
	for (let page = 1; page <= 50; page++) {
		const body = await get<{ resources?: PangolinResource[]; pagination?: { total?: number } }>(
			f,
			`${base}/org/${encodeURIComponent(org)}/resources?page=${page}&pageSize=100&sort_by=name&order=asc`,
			key
		);
		const rows = body.resources ?? [];
		const before = seen.size;
		for (const r of rows) seen.set(r.resourceId, r);
		const total = body.pagination?.total;
		// Stop at the end, or when a page adds nothing (older versions ignore `page`).
		if (!rows.length || seen.size === before || (total !== undefined && seen.size >= total) || rows.length < 100) break;
	}
	return [...seen.values()];
}

async function firstOrg(base: string, key: string, f: Fetch): Promise<string> {
	const body = await get<{ orgs?: { orgId: string }[] }>(f, `${base}/orgs`, key);
	const org = body.orgs?.[0]?.orgId;
	if (!org) throw new PangolinError('Set PANGOLIN_ORG_ID: this API key can’t list organisations.');
	return org;
}

async function get<T>(f: Fetch, url: string, key: string): Promise<T> {
	let res: Response;
	try {
		res = await f(url, { headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
	} catch (err) {
		throw new PangolinError(`Couldn’t reach Pangolin at ${new URL(url).origin}: ${(err as Error).message}`);
	}
	const text = await res.text();
	let json: { data?: T; message?: string } = {};
	try {
		json = JSON.parse(text);
	} catch {
		// Usually the dashboard's HTML: the URL is missing /v1 or points at the wrong host.
		throw new PangolinError(`Pangolin answered ${res.status} with something other than JSON. Is PANGOLIN_API_URL the Integration API (…/v1)?`);
	}
	if (res.status === 401 || res.status === 403) throw new PangolinError(`Pangolin refused the API key (${res.status}${json.message ? `: ${json.message}` : ''}). It needs the List Resources permission.`);
	if (!res.ok) throw new PangolinError(`Pangolin answered ${res.status}${json.message ? `: ${json.message}` : ''}`);
	return json.data ?? ({} as T);
}

/** Only enabled HTTP resources with a concrete hostname can be opened in a browser. */
export function isWebResource(r: PangolinResource): boolean {
	if (r.enabled === false || !r.fullDomain || r.wildcard || r.fullDomain.includes('*')) return false;
	if (r.mode) return r.mode === 'http';
	return r.http !== false;
}

export function healthOf(r: PangolinResource): Health {
	const h = (r.health ?? '').toLowerCase();
	if (h === 'healthy' || h === 'degraded' || h === 'unhealthy') return h;
	if (h === 'offline') return 'unhealthy';
	const sites = (r.sites ?? []).filter((s) => typeof s.online === 'boolean');
	if (sites.length && sites.every((s) => !s.online)) return 'unhealthy';
	if (sites.some((s) => !s.online)) return 'degraded';
	// No health checks configured: the tunnel being up is the best signal there is.
	if (sites.length) return 'healthy';
	return 'unknown';
}
