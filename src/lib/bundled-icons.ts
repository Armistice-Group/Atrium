import type { Icon } from '#lib/types.ts';

/**
 * Our own apps' logos, shipped in static/icons/ since dashboard-icons doesn't have them.
 * Matched before dashboard-icons, by name ("Debrief"), as an icon field value ("debrief") or by host.
 */
export const BUNDLED_ICONS: Record<string, Icon & { hosts?: string[] }> = {
	// Debrief's bars take lighter shades in dark mode, as they do in Debrief itself.
	debrief: { light: '/icons/debrief.svg', dark: '/icons/debrief-dark.svg' },
	// A dark tile in light mode and a light one in dark mode, like Consultainer's own mark.
	consultainer: { light: '/icons/consultainer.svg', dark: '/icons/consultainer-dark.svg', hosts: ['time.armgrp.dev'] },
	warden: { light: '/icons/warden.png', dark: '/icons/warden.png' },
	// The hub's own pinwheel, for a tile that points back at the hub itself.
	hub: { light: '/favicon.svg', dark: '/favicon.svg', hosts: ['hub.armgrp.dev'] },
	'hub-modern': { light: '/favicon.svg', dark: '/favicon.svg' },
	lanthorn: { light: '/icons/lanthorn.svg', dark: '/icons/lanthorn.svg' },
	// Orbital's mark, under each name it has gone by.
	orbital: { light: '/icons/orbital.svg', dark: '/icons/orbital.svg' },
	orbit: { light: '/icons/orbital.svg', dark: '/icons/orbital.svg' },
	'cc-lab': { light: '/icons/orbital.svg', dark: '/icons/orbital.svg' },
	'claude-lab': { light: '/icons/orbital.svg', dark: '/icons/orbital.svg' },
	'cc-modern': { light: '/icons/orbital.svg', dark: '/icons/orbital.svg' }
};

export function bundledIcon(slug: string): Icon | null {
	const b = BUNDLED_ICONS[slug];
	return b ? { light: b.light, dark: b.dark } : null;
}

export function bundledIconForHost(host: string): Icon | null {
	const h = host.toLowerCase();
	const slug = Object.keys(BUNDLED_ICONS).find((k) => BUNDLED_ICONS[k].hosts?.includes(h));
	return slug ? bundledIcon(slug) : null;
}
