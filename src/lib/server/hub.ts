import type { Hub, Service, ServiceEdit } from '#lib/types.ts';
import { config as defaults, type Config } from './config.ts';
import { allConnections, type Source } from './connections.ts';
import { readServicesFile, type FileEntry, type ServicesFile } from './file.ts';
import { iconCatalog, resolveIcon, settleIcons, slugify } from './icons.ts';
import { healthOf, isWebResource, listResources, type PangolinResource } from './pangolin.ts';
import { readStore } from './store.ts';

interface Cache {
	resources: PangolinResource[];
	at: number;
	error: string | null;
	lastGood: number | null;
	/** URL, key and org the list came from: an edit to any of them starts afresh. */
	fingerprint: string;
}

/** A resource and the connection it came from ("env" keeps the ids pins were saved under before connections). */
export type Tagged = PangolinResource & { conn?: string };

const caches = new Map<string, Cache>();
const inflight = new Map<string, Promise<Cache>>();

/** One connection's resources, refreshed at most every HUB_REFRESH_SECONDS. A failure keeps the last good list. */
async function pangolinResources(c: Source, cfg: Config, f: typeof fetch): Promise<Cache> {
	const fingerprint = `${c.url}\n${c.key}\n${c.org}`;
	const prev = caches.get(c.id)?.fingerprint === fingerprint ? caches.get(c.id) : undefined;
	if (prev && Date.now() - prev.at < cfg.refreshSeconds * 1000) return prev;
	const running = inflight.get(c.id);
	if (running) return running;
	const job = (async () => {
		let next: Cache;
		try {
			const resources = await listResources(c.url, c.key, c.org, f);
			next = { resources, at: Date.now(), error: null, lastGood: Date.now(), fingerprint };
		} catch (err) {
			next = { resources: prev?.resources ?? [], at: Date.now(), error: (err as Error).message, lastGood: prev?.lastGood ?? null, fingerprint };
		} finally {
			inflight.delete(c.id);
		}
		caches.set(c.id, next);
		return next;
	})();
	inflight.set(c.id, job);
	return job;
}

/** Drops one connection's list (after it's edited or removed), or all of them. */
export function resetCache(id?: string) {
	if (id) caches.delete(id);
	else caches.clear();
}

/** What the settings page shows next to a connection; null until it's been asked. */
export function connectionStatus(id: string) {
	const c = caches.get(id);
	if (!c) return null;
	return { error: c.error, lastGood: c.lastGood ? new Date(c.lastGood).toISOString() : null, count: c.resources.filter(isWebResource).length };
}

const key = (s: string) => s.trim().toLowerCase();

/** Every enabled connection's services with services.yaml and the UI's edits applied, plus the file's extra links. */
export async function buildHub(cfg: Config = defaults, f: typeof fetch = fetch): Promise<Hub> {
	const [{ file, error: fileError }, store, icons] = await Promise.all([
		readServicesFile(cfg.servicesFile),
		readStore(cfg.dataDir),
		cfg.icons ? iconCatalog(f) : Promise.resolve(null)
	]);
	const connections = (await allConnections(cfg)).filter((c) => c.enabled);
	const results = await Promise.all(connections.map((c) => pangolinResources(c, cfg, f)));
	const resources = results.flatMap((r, i) => r.resources.map((res): Tagged => ({ ...res, conn: connections[i].id })));
	const services = assemble(resources, file, cfg, icons, store.edits, store.groups.renames);
	await settleIcons(services.map((s) => s.icon), f);
	const failures = results.map((r, i) => (r.error ? (connections.length > 1 ? `${connections[i].name}: ${r.error}` : r.error) : null)).filter(Boolean);
	const pangolin = connections.length > 0;
	const empty = !pangolin && !file.entries.length;
	const error = failures.join(' · ') || fileError || (empty ? 'Pangolin isn’t connected yet: add a connection in Settings, or list services in services.yaml.' : null);
	const goods = results.map((r) => r.lastGood).filter((t): t is number => t !== null);
	return {
		title: cfg.title,
		services,
		groups: orderGroups(services, store.groups.order.length ? store.groups.order : file.groups, cfg.defaultGroup),
		error,
		updatedAt: goods.length ? new Date(Math.min(...goods)).toISOString() : null,
		pangolin,
		newTab: cfg.newTab
	};
}

export function assemble(
	resources: Tagged[],
	file: ServicesFile,
	cfg: Config,
	icons: Awaited<ReturnType<typeof iconCatalog>>,
	edits: Record<string, ServiceEdit> = {},
	renames: Record<string, string> = {}
): Service[] {
	const regroup = (g: string) => renames[key(g)] ?? g;
	const overrides = file.entries.filter((e) => e.match);
	const findOverride = (r: PangolinResource) => overrides.find((o) => [r.name, r.fullDomain ?? '', r.niceId ?? ''].some((v) => v && key(v) === key(o.match!)));
	const hidden = (name: string, host: string) => cfg.hide.includes(key(name)) || cfg.hide.includes(key(host));
	const out: Service[] = [];
	const hosts = new Set<string>();

	for (const r of resources) {
		if (!isWebResource(r)) continue;
		const host = r.fullDomain!;
		// The same hostname from two connections (two keys for one org): show it once.
		if (hosts.has(key(host))) continue;
		hosts.add(key(host));
		const id = !r.conn || r.conn === 'env' ? `p-${r.resourceId}` : `p-${r.conn}-${r.resourceId}`;
		const e = edits[id] ?? {};
		const o: FileEntry = findOverride(r) ?? {};
		const labels = (r.labels ?? []).map((l) => l.name).filter(Boolean);
		if (e.hidden || o.hidden || labels.some((l) => key(l) === 'hidden') || hidden(r.name, host)) continue;
		const name = e.name || o.name || r.name;
		out.push({
			id,
			name,
			url: o.url ?? `${r.ssl === false ? 'http' : 'https'}://${host}`,
			host,
			group: regroup(e.group || o.group || labels[0] || cfg.defaultGroup),
			description: e.description || o.description || '',
			icon: resolveIcon(icons, e.icon || o.icon, name, host, r.niceId),
			health: healthOf(r),
			sites: (r.sites ?? []).filter((x) => x.siteName).map((x) => ({ name: x.siteName!, online: typeof x.online === 'boolean' ? x.online : null })),
			wide: !!e.wide,
			source: 'pangolin',
			edit: edits[id] ?? null
		});
	}

	for (const e of file.entries) {
		if (e.match || !e.url || e.hidden) continue;
		const host = new URL(e.url).host;
		const id = `f-${slugify(e.name ?? host)}-${slugify(host)}`;
		const ed = edits[id] ?? {};
		const name = ed.name || e.name || host;
		if (ed.hidden || hidden(name, host)) continue;
		out.push({
			id,
			name,
			url: e.url,
			host,
			group: regroup(ed.group || e.group || cfg.defaultGroup),
			description: ed.description || e.description || '',
			icon: resolveIcon(icons, ed.icon || e.icon, name, host),
			health: 'unknown',
			sites: [],
			wide: !!ed.wide,
			source: 'file',
			edit: edits[id] ?? null
		});
	}
	return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** The file's order first, then the rest alphabetically, with the default group ahead of them. */
export function orderGroups(services: Service[], preferred: string[], defaultGroup: string): string[] {
	const present = [...new Set(services.map((s) => s.group))];
	const first = preferred.filter((g) => present.includes(g));
	const rest = present
		.filter((g) => !first.includes(g))
		.sort((a, b) => (a === defaultGroup ? -1 : b === defaultGroup ? 1 : a.localeCompare(b, undefined, { sensitivity: 'base' })));
	return [...first, ...rest];
}
