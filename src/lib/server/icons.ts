import { bundledIcon, bundledIconForHost } from '#lib/bundled-icons.ts';
import type { Icon } from '#lib/types.ts';

/** Icons from homarr-labs/dashboard-icons (https://github.com/homarr-labs/dashboard-icons), served by jsDelivr. */
const CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';
const DAY = 24 * 60 * 60 * 1000;

interface Catalog {
	svg: Set<string>;
	png: Set<string>;
	at: number;
}

let catalog: Catalog | null = null;
let loading: Promise<Catalog | null> | null = null;

/** The list of icon names, fetched once a day. Null when the CDN can't be reached (letter tiles then). */
export async function iconCatalog(f: typeof fetch = fetch): Promise<Catalog | null> {
	if (catalog && Date.now() - catalog.at < DAY) return catalog;
	loading ??= (async () => {
		try {
			const res = await f(`${CDN}/tree.json`, { signal: AbortSignal.timeout(8000) });
			if (!res.ok) return catalog;
			const tree = (await res.json()) as { svg?: string[]; png?: string[] };
			const strip = (list: string[] | undefined, ext: string) => new Set((list ?? []).map((n) => n.replace(new RegExp(`\\.${ext}$`), '')));
			catalog = { svg: strip(tree.svg, 'svg'), png: strip(tree.png, 'png'), at: Date.now() };
			return catalog;
		} catch {
			return catalog;
		} finally {
			loading = null;
		}
	})();
	return loading;
}

export function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function fromCatalog(c: Catalog, slug: string): Icon | null {
	for (const [ext, set] of [['svg', c.svg], ['png', c.png]] as const) {
		if (!set.has(slug)) continue;
		const url = (name: string) => `${CDN}/${ext}/${name}.${ext}`;
		const variants = [slug, `${slug}-light`, `${slug}-dark`].filter((n) => set.has(n)).map(url);
		// A first guess from the names; settleIcons() measures SVGs, since the set isn't consistent
		// about whether "-dark" means "dark-coloured" or "for dark mode".
		const icon: Icon = { light: url(slug), dark: set.has(`${slug}-dark`) ? url(`${slug}-dark`) : url(slug) };
		if (variants.length > 1 && ext === 'svg') pending.set(icon, variants);
		return icon;
	}
	return null;
}

/** Icons whose variants still need measuring. */
const pending = new WeakMap<Icon, string[]>();
const brightness = new Map<string, Promise<number | null>>();

/** Average lightness (0–1) of an SVG's fills and strokes; unfilled shapes count as black. */
export function svgBrightness(svg: string): number | null {
	const colours = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}\b|white|black|rgb\([^)]*\))/gi)].map((m) => m[1].toLowerCase());
	const values = colours.map(lightness).filter((v): v is number => v !== null);
	if (!values.length) return /<(path|rect|circle|polygon|ellipse)\b/i.test(svg) ? 0 : null;
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function lightness(c: string): number | null {
	if (c === 'white') return 1;
	if (c === 'black') return 0;
	let r: number, g: number, b: number;
	const rgb = c.match(/rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
	if (rgb) [r, g, b] = rgb.slice(1).map(Number);
	else {
		let hex = c.slice(1);
		if (hex.length === 3 || hex.length === 4) hex = [...hex.slice(0, 3)].map((x) => x + x).join('');
		[r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
	}
	if ([r, g, b].some(Number.isNaN)) return null;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

async function measure(url: string, f: typeof fetch): Promise<number | null> {
	let p = brightness.get(url);
	if (!p) {
		p = f(url, { signal: AbortSignal.timeout(5000) })
			.then((r) => (r.ok ? r.text() : null))
			.then((t) => (t ? svgBrightness(t) : null))
			.catch(() => null);
		brightness.set(url, p);
	}
	return p;
}

/** For icons with variants: the darkest one in light mode, the brightest in dark mode. Measured once per file. */
export async function settleIcons(icons: (Icon | null)[], f: typeof fetch = fetch): Promise<void> {
	await Promise.all(
		icons.map(async (icon) => {
			const variants = icon && pending.get(icon);
			if (!icon || !variants) return;
			const measured = (await Promise.all(variants.map(async (url) => ({ url, v: await measure(url, f) })))).filter((m): m is { url: string; v: number } => m.v !== null);
			if (measured.length < 2) return;
			measured.sort((a, b) => a.v - b.v);
			icon.light = measured[0].url;
			icon.dark = measured[measured.length - 1].url;
		})
	);
}

/**
 * An explicit icon (a URL, or a bundled or dashboard-icons name), else the first name that matches:
 * the service name, then each part of its hostname ("grafana" in grafana.example.com).
 * Bundled icons come first and need no catalog, since they're served by the hub itself.
 */
export function resolveIcon(c: Catalog | null, explicit: string | undefined, name: string, host: string, niceId?: string): Icon | null {
	if (explicit) {
		if (/^(https?:)?\/\//.test(explicit) || explicit.startsWith('/')) return { light: explicit, dark: explicit };
		const slug = slugify(explicit);
		return bundledIcon(slug) ?? (c ? fromCatalog(c, slug) : null);
	}
	const words = slugify(name);
	const candidates = [words, words.replace(/-/g, ''), words.split('-')[0], niceId ? slugify(niceId) : '', ...host.split('.').slice(0, -2).map(slugify)].filter(Boolean);
	const own = bundledIconForHost(host) ?? candidates.map(bundledIcon).find(Boolean);
	if (own) return own;
	if (!c) return null;
	for (const slug of candidates) {
		const icon = fromCatalog(c, slug);
		if (icon) return icon;
	}
	return null;
}
