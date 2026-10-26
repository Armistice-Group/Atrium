import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemble, orderGroups } from '../src/lib/server/hub.ts';
import { parseServicesFile } from '../src/lib/server/file.ts';
import { healthOf, isWebResource, listResources, type PangolinResource } from '../src/lib/server/pangolin.ts';
import { resolveIcon, settleIcons, svgBrightness } from '../src/lib/server/icons.ts';
import type { Config } from '../src/lib/server/config.ts';
import { isAdmin, parseConnection } from '../src/lib/server/connections.ts';
import { forgetStore, readStore, updateStore } from '../src/lib/server/store.ts';
import { renameGroup } from '../src/lib/server/groups.ts';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cfg: Config = { pangolinUrl: 'https://api.example.com/v1', pangolinKey: 'k', pangolinOrg: 'home', servicesFile: '', dataDir: '', admins: [], title: 'hub', defaultGroup: 'Services', hide: ['secret.example.com'], refreshSeconds: 60, newTab: true, icons: true };
const res = (id: number, name: string, fullDomain: string, extra: Partial<PangolinResource> = {}): PangolinResource => ({ resourceId: id, name, fullDomain, ssl: true, enabled: true, mode: 'http', ...extra });
const catalog = { svg: new Set(['grafana', 'jellyfin', 'github', 'github-dark']), png: new Set(['portainer']), at: Date.now() };

/** A fetch that serves Pangolin pages of `size` from `all`, recording the URLs it was asked for. */
function fakePangolin(all: PangolinResource[], size = 100, paginates = true) {
	const urls: string[] = [];
	const f = (async (input: string | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		urls.push(url.pathname + url.search);
		assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer k');
		if (url.pathname.endsWith('/orgs')) return Response.json({ data: { orgs: [{ orgId: 'home' }] } });
		const page = paginates ? Number(url.searchParams.get('page')) : 1;
		const rows = paginates ? all.slice((page - 1) * size, page * size) : all;
		return Response.json({ data: { resources: rows, pagination: paginates ? { total: all.length, page, pageSize: size } : undefined }, success: true });
	}) as typeof fetch;
	return { f, urls };
}

test('follows pagination and stops on versions that ignore it', async () => {
	const all = Array.from({ length: 230 }, (_, i) => res(i + 1, `svc${i}`, `svc${i}.example.com`));
	const a = fakePangolin(all);
	assert.equal((await listResources(cfg.pangolinUrl, 'k', 'home', a.f)).length, 230);
	assert.equal(a.urls.length, 3);
	const b = fakePangolin(all, 100, false);
	assert.equal((await listResources(cfg.pangolinUrl, 'k', 'home', b.f)).length, 230);
	assert.equal(b.urls.length, 2, 'a repeated page ends the loop');
	const c = fakePangolin(all.slice(0, 3));
	await listResources(cfg.pangolinUrl, 'k', '', c.f);
	assert.match(c.urls[0], /\/orgs$/, 'finds the org when none is set');
});

test('reports a wrong URL or key clearly', async () => {
	const html = (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch;
	await assert.rejects(listResources(cfg.pangolinUrl, 'k', 'home', html), /Integration API/);
	const denied = (async () => Response.json({ message: 'Key invalid' }, { status: 401 })) as unknown as typeof fetch;
	await assert.rejects(listResources(cfg.pangolinUrl, 'k', 'home', denied), /refused the API key.*Key invalid/);
});

test('only enabled HTTP resources with a real hostname are shown', () => {
	assert.equal(isWebResource(res(1, 'a', 'a.example.com')), true);
	assert.equal(isWebResource(res(1, 'a', 'a.example.com', { enabled: false })), false);
	assert.equal(isWebResource(res(1, 'a', 'a.example.com', { mode: 'tcp' })), false);
	assert.equal(isWebResource(res(1, 'a', '*.example.com', { wildcard: true })), false);
	assert.equal(isWebResource({ resourceId: 1, name: 'old', fullDomain: 'old.example.com', http: false }), false);
	assert.equal(isWebResource({ resourceId: 1, name: 'old', fullDomain: 'old.example.com', http: true }), true);
	assert.equal(isWebResource(res(1, 'raw', null as unknown as string)), false);
});

test('health comes from Pangolin, else from whether the sites are online', () => {
	assert.equal(healthOf(res(1, 'a', 'a', { health: 'unhealthy' })), 'unhealthy');
	assert.equal(healthOf(res(1, 'a', 'a', { health: 'unknown', sites: [{ online: false }] })), 'unhealthy');
	assert.equal(healthOf(res(1, 'a', 'a', { health: 'unknown', sites: [{ online: true }, { online: false }] })), 'degraded');
	assert.equal(healthOf(res(1, 'a', 'a', { health: 'unknown', sites: [{ online: true }] })), 'healthy');
	assert.equal(healthOf(res(1, 'a', 'a', { sites: [{}] })), 'unknown');
});

test('labels group services, "hidden" hides them, and services.yaml adds and overrides', () => {
	const { file, error } = parseServicesFile(`
groups: [Media, Monitoring]
services:
  - match: grafana.example.com
    description: Dashboards
    group: Monitoring
  - match: Old thing
    hidden: true
  - name: Router
    url: https://192.168.1.1
    group: Network
    icon: https://example.com/router.png
`);
	assert.equal(error, null);
	const services = assemble(
		[
			res(1, 'Grafana', 'grafana.example.com'),
			res(2, 'Jellyfin', 'tv.example.com', { labels: [{ name: 'Media' }] }),
			res(3, 'Old thing', 'old.example.com'),
			res(4, 'Backups', 'backups.example.com', { labels: [{ name: 'Hidden' }] }),
			res(5, 'Secret', 'secret.example.com'),
			res(6, 'Portainer', 'docker.example.com', { ssl: false })
		],
		file,
		cfg,
		catalog
	);
	assert.deepEqual(
		services.map((s) => [s.name, s.group]),
		[['Grafana', 'Monitoring'], ['Jellyfin', 'Media'], ['Portainer', 'Services'], ['Router', 'Network']]
	);
	assert.equal(services.find((s) => s.name === 'Grafana')!.description, 'Dashboards');
	assert.equal(services.find((s) => s.name === 'Portainer')!.url, 'http://docker.example.com');
	assert.equal(services.find((s) => s.name === 'Router')!.icon!.light, 'https://example.com/router.png');
	assert.deepEqual(orderGroups(services, file.groups, 'Services'), ['Media', 'Monitoring', 'Services', 'Network']);
});

test('services.yaml mistakes are reported', () => {
	assert.match(parseServicesFile('services: [').error!, /isn’t valid YAML/);
	assert.match(parseServicesFile('services:\n  - name: x\n    url: ftp://x').error!, /http/);
	assert.deepEqual(parseServicesFile('- name: A\n  url: https://a.example.com').file.entries.length, 1, 'a bare list works too');
});

test('icons match by name, then hostname, with dark-mode variants', () => {
	assert.match(resolveIcon(catalog, undefined, 'Grafana', 'grafana.example.com')!.light, /svg\/grafana\.svg$/);
	assert.match(resolveIcon(catalog, undefined, 'Media server', 'jellyfin.example.com')!.light, /jellyfin/);
	assert.match(resolveIcon(catalog, undefined, 'Containers', 'portainer.example.com')!.light, /png\/portainer\.png$/);
	assert.equal(resolveIcon(catalog, undefined, 'Thing', 'thing.example.com'), null);
	assert.equal(resolveIcon(null, undefined, 'Grafana', 'grafana.example.com'), null);
});

test('our own apps use the logos bundled with the hub, even with no catalog', () => {
	assert.equal(resolveIcon(catalog, undefined, 'Debrief', 'debrief.example.com')!.light, '/icons/debrief.svg');
	assert.equal(resolveIcon(null, undefined, 'Warden station', 'w.example.com')!.light, '/icons/warden.png');
	assert.deepEqual(resolveIcon(null, undefined, 'Time', 'time.armgrp.dev'), { light: '/icons/consultainer.svg', dark: '/icons/consultainer-dark.svg' });
	assert.equal(resolveIcon(null, 'Consultainer', 'Billing', 'billing.example.com')!.dark, '/icons/consultainer-dark.svg');
});

test('icon variants are measured, since their names can mean either theme', async () => {
	const svgs: Record<string, string> = {
		'github.svg': '<svg><path d="M0 0"/></svg>',
		'github-dark.svg': '<svg><path fill="#fff" d="M0 0"/></svg>',
		'vault.svg': '<svg><path fill="#175DDC"/><path style="fill:#000"/></svg>',
		'vault-dark.svg': '<svg><path fill="#000000"/></svg>',
		'vault-light.svg': '<svg><path fill="white"/></svg>'
	};
	const f = (async (u: string) => {
		const name = String(u).split('/').pop()!;
		return svgs[name] ? new Response(svgs[name]) : new Response('', { status: 404 });
	}) as unknown as typeof fetch;
	const cat = { svg: new Set(['github', 'github-dark', 'vault', 'vault-dark', 'vault-light']), png: new Set<string>(), at: Date.now() };
	const gh = resolveIcon(cat, undefined, 'GitHub', 'git.example.com')!;
	const vault = resolveIcon(cat, undefined, 'Vault', 'vault.example.com')!;
	await settleIcons([gh, vault, null], f);
	assert.match(gh.light, /github\.svg$/);
	assert.match(gh.dark, /github-dark\.svg$/);
	assert.match(vault.light, /vault-dark\.svg$/, 'the black one, even though it’s called -dark');
	assert.match(vault.dark, /vault-light\.svg$/);
	assert.ok(Math.abs(svgBrightness('<svg><path fill="#ffffff"/><path fill="#000"/></svg>')! - 0.5) < 1e-9);
	assert.equal(svgBrightness('<svg><text>x</text></svg>'), null);
});

test('several connections: ids stay apart, and a hostname twice shows once', () => {
	const services = assemble(
		[
			{ ...res(1, 'Grafana', 'grafana.example.com'), conn: 'env' },
			{ ...res(1, 'Immich', 'photos.example.com'), conn: 'ab12' },
			{ ...res(9, 'Grafana again', 'GRAFANA.example.com'), conn: 'ab12' }
		],
		{ groups: [], entries: [] },
		cfg,
		catalog
	);
	assert.deepEqual(services.map((s) => s.id).sort(), ['p-1', 'p-ab12-1']);
});

test('tile edits beat services.yaml, and hidden tiles leave the page', () => {
	const { file } = parseServicesFile('services:\n  - match: Grafana\n    icon: jellyfin\n    group: Monitoring');
	const services = assemble(
		[res(1, 'Grafana', 'grafana.example.com'), res(2, 'Old', 'old.example.com')],
		file,
		cfg,
		catalog,
		{ 'p-1': { name: 'Graphs', icon: 'https://example.com/g.svg' }, 'p-2': { hidden: true } }
	);
	assert.equal(services.length, 1);
	assert.equal(services[0].name, 'Graphs');
	assert.equal(services[0].group, 'Monitoring', 'what the edit leaves empty still comes from the file');
	assert.equal(services[0].icon!.light, 'https://example.com/g.svg');
	assert.deepEqual(services[0].edit, { name: 'Graphs', icon: 'https://example.com/g.svg' });
});

test('settings are saved privately and survive a restart', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'hub-'));
	forgetStore();
	await updateStore(dir, (s) => void s.connections.push({ id: 'a', name: 'Cloud', url: 'https://api.pangolin.net/v1', key: 'secret', org: 'home', enabled: true }));
	await Promise.all([updateStore(dir, (s) => void (s.edits.x = { icon: 'grafana' })), updateStore(dir, (s) => void (s.edits.y = { hidden: true }))]);
	assert.equal((await stat(join(dir, 'hub.json'))).mode & 0o777, 0o600);
	forgetStore();
	const store = await readStore(dir);
	assert.equal(store.connections[0].key, 'secret');
	assert.deepEqual(Object.keys(store.edits).sort(), ['x', 'y'], 'saves made together both land');
});

test('connection forms are checked, and HUB_ADMINS limits who may change them', () => {
	assert.deepEqual(parseConnection({ url: 'https://api.pangolin.net/v1/', key: 'k' }), { input: { name: 'api.pangolin.net', url: 'https://api.pangolin.net/v1', key: 'k', org: '', enabled: true } });
	assert.match((parseConnection({ url: 'ftp://x' }) as { error: string }).error, /http/);
	assert.match((parseConnection({ url: '' }) as { error: string }).error, /URL/);
	const viewer = { name: 'N', email: 'Me@Example.com', username: 'me', role: '' };
	assert.equal(isAdmin(null, cfg), true, 'no list: everyone Pangolin lets in');
	assert.equal(isAdmin(viewer, { ...cfg, admins: ['me@example.com'] }), true);
	assert.equal(isAdmin({ ...viewer, email: 'other@example.com', username: 'other' }, { ...cfg, admins: ['me@example.com'] }), false);
	assert.equal(isAdmin(null, { ...cfg, admins: ['me@example.com'] }), false);
});

test('sites come through with their status; the local site has none', () => {
	const [s] = assemble(
		[res(1, 'Grafana', 'grafana.example.com', { sites: [{ siteId: 1, siteName: 'HP', online: true }, { siteId: 2, siteName: 'Local' }, { siteId: 3, siteName: '' }] })],
		{ groups: [], entries: [] },
		cfg,
		catalog
	);
	assert.deepEqual(s.sites, [{ name: 'HP', online: true }, { name: 'Local', online: null }]);
});

test('renaming groups carries their tiles, edits and place along', () => {
	const s = { connections: [], edits: { a: { group: 'Media' } }, groups: { order: ['Media', 'Tools', 'Network'], renames: {} as Record<string, string> } };
	renameGroup(s, 'Media', 'Watch');
	renameGroup(s, 'Watch', 'TV');
	assert.deepEqual(s.groups.renames, { media: 'TV', watch: 'TV' });
	assert.equal(s.edits.a.group, 'TV');
	assert.deepEqual(s.groups.order, ['TV', 'Tools', 'Network']);
	renameGroup(s, 'Network', 'Tools');
	assert.deepEqual(s.groups.order, ['TV', 'Tools'], 'merging keeps one place');
	renameGroup(s, 'TV', 'Media');
	assert.equal(s.groups.renames.media, undefined, 'renaming back removes the rename');

	const services = assemble(
		[res(1, 'Jellyfin', 'tv.example.com', { labels: [{ name: 'media' }] }), res(2, 'Plex', 'plex.example.com', { labels: [{ name: 'Watch' }] })],
		{ groups: [], entries: [] },
		cfg,
		catalog,
		{ 'p-2': { wide: true } },
		{ media: 'TV' }
	);
	assert.deepEqual(services.map((x) => [x.name, x.group, x.wide]), [['Jellyfin', 'TV', false], ['Plex', 'Watch', true]]);
});
