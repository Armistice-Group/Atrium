import type { Hub, Service } from '#lib/types.ts';
import { config as defaults, type Config } from './config.ts';
import { readServicesFile, type FileEntry, type ServicesFile } from './file.ts';
import { iconCatalog, resolveIcon, settleIcons, slugify } from './icons.ts';
import { healthOf, isWebResource, listResources, type PangolinResource } from './pangolin.ts';

interface Cache {
	resources: PangolinResource[];
	at: number;
	error: string | null;
	lastGood: number | null;
}

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

/** Pangolin's resources, refreshed at most every HUB_REFRESH_SECONDS. A failure keeps the last good list. */
async function pangolinResources(cfg: Config, f: typeof fetch): Promise<Cache> {
	if (cache && Date.now() - cache.at < cfg.refreshSeconds * 1000) return cache;
	inflight ??= (async () => {
		try {
			const resources = await listResources(cfg.pangolinUrl, cfg.pangolinKey, cfg.pangolinOrg, f);
			cache = { resources, at: Date.now(), error: null, lastGood: Date.now() };
		} catch (err) {
			cache = { resources: cache?.resources ?? [], at: Date.now(), error: (err as Error).message, lastGood: cache?.lastGood ?? null };
		} finally {
			inflight = null;
		}
		return cache!;
	})();
	return inflight;
}

export function resetCache() {
	cache = null;
}

const key = (s: string) => s.trim().toLowerCase();

/** Pangolin's services with the file's overrides applied, plus the file's extra links, grouped and sorted. */
export async function buildHub(cfg: Config = defaults, f: typeof fetch = fetch): Promise<Hub> {
	const pangolin = !!(cfg.pangolinUrl && cfg.pangolinKey);
	const [{ file, error: fileError }, p, icons] = await Promise.all([
		readServicesFile(cfg.servicesFile),
		pangolin ? pangolinResources(cfg, f) : Promise.resolve(null),
		cfg.icons ? iconCatalog(f) : Promise.resolve(null)
	]);
	const services = assemble(p?.resources ?? [], file, cfg, icons);
	await settleIcons(services.map((s) => s.icon), f);
	const error = p?.error ?? fileError ?? (pangolin ? null : file.entries.length ? null : 'Pangolin isn’t connected: set PANGOLIN_API_URL and PANGOLIN_API_KEY, or list services in services.yaml.');
	return {
		title: cfg.title,
		services,
		groups: orderGroups(services, file.groups, cfg.defaultGroup),
		error,
		updatedAt: p?.lastGood ? new Date(p.lastGood).toISOString() : null,
		pangolin,
		newTab: cfg.newTab
	};
}

export function assemble(resources: PangolinResource[], file: ServicesFile, cfg: Config, icons: Awaited<ReturnType<typeof iconCatalog>>): Service[] {
	const overrides = file.entries.filter((e) => e.match);
	const findOverride = (r: PangolinResource) => overrides.find((o) => [r.name, r.fullDomain ?? '', r.niceId ?? ''].some((v) => v && key(v) === key(o.match!)));
	const hidden = (name: string, host: string) => cfg.hide.includes(key(name)) || cfg.hide.includes(key(host));
	const out: Service[] = [];

	for (const r of resources) {
		if (!isWebResource(r)) continue;
		const o: FileEntry = findOverride(r) ?? {};
		const host = r.fullDomain!;
		const labels = (r.labels ?? []).map((l) => l.name).filter(Boolean);
		if (o.hidden || labels.some((l) => key(l) === 'hidden') || hidden(r.name, host)) continue;
		const name = o.name ?? r.name;
		out.push({
			id: `p-${r.resourceId}`,
			name,
			url: o.url ?? `${r.ssl === false ? 'http' : 'https'}://${host}`,
			host,
			group: o.group ?? labels[0] ?? cfg.defaultGroup,
			description: o.description ?? '',
			icon: resolveIcon(icons, o.icon, name, host, r.niceId),
			health: healthOf(r),
			source: 'pangolin'
		});
	}

	for (const e of file.entries) {
		if (e.match || !e.url || e.hidden) continue;
		const host = new URL(e.url).host;
		const name = e.name ?? host;
		if (hidden(name, host)) continue;
		out.push({
			id: `f-${slugify(name)}-${slugify(host)}`,
			name,
			url: e.url,
			host,
			group: e.group ?? cfg.defaultGroup,
			description: e.description ?? '',
			icon: resolveIcon(icons, e.icon, name, host),
			health: 'unknown',
			source: 'file'
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
