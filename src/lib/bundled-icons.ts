import type { Icon } from '#lib/types.ts';

/**
 * Our own apps' logos, shipped in static/icons/ since dashboard-icons doesn't have them.
 * Matched before dashboard-icons, by name ("Debrief"), as an icon field value ("debrief") or by host.
 */
export const BUNDLED_ICONS: Record<string, Icon & { hosts?: string[] }> = {
	debrief: { light: '/icons/debrief.svg', dark: '/icons/debrief.svg' },
	// A dark tile in light mode and a light one in dark mode, like Consultainer's own mark.
	consultainer: { light: '/icons/consultainer.svg', dark: '/icons/consultainer-dark.svg', hosts: ['time.armgrp.dev'] },
	warden: { light: '/icons/warden.png', dark: '/icons/warden.png' },
	// The hub's own pinwheel, for a tile that points back at the hub itself.
	hub: { light: '/favicon.svg', dark: '/favicon.svg', hosts: ['hub.armgrp.dev'] },
	'hub-modern': { light: '/favicon.svg', dark: '/favicon.svg' },
	lanthorn: { light: '/icons/lanthorn.svg', dark: '/icons/lanthorn.svg' },
	// The lab's orbit mark, under each name it goes by.
	'cc-lab': { light: '/icons/cc-lab.svg', dark: '/icons/cc-lab.svg' },
	'claude-lab': { light: '/icons/cc-lab.svg', dark: '/icons/cc-lab.svg' },
	orbit: { light: '/icons/cc-lab.svg', dark: '/icons/cc-lab.svg' }
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
