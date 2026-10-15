import { env } from 'node:process';

const bool = (v: string | undefined, fallback: boolean) => (v === undefined || v === '' ? fallback : !/^(0|false|no|off)$/i.test(v));

/** Everything comes from the environment; see README.md and compose.yaml. */
export const config = {
	/** Pangolin's Integration API, e.g. https://api.example.com/v1 */
	pangolinUrl: (env.PANGOLIN_API_URL ?? '').replace(/\/+$/, ''),
	pangolinKey: env.PANGOLIN_API_KEY ?? '',
	pangolinOrg: env.PANGOLIN_ORG_ID ?? '',
	/** Extra links and overrides. */
	servicesFile: env.HUB_SERVICES_FILE ?? (env.NODE_ENV === 'production' ? '/data/services.yaml' : './services.yaml'),
	title: env.HUB_TITLE || 'hub·modern',
	/** Group for services without a Pangolin label. */
	defaultGroup: env.HUB_DEFAULT_GROUP || 'Services',
	/** Names or hosts never shown (comma-separated), on top of the Pangolin label "hidden". */
	hide: (env.HUB_HIDE ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean),
	refreshSeconds: Math.max(10, Number(env.HUB_REFRESH_SECONDS) || 60),
	newTab: bool(env.HUB_NEW_TAB, true),
	/** Set to false to show letter tiles only (no requests to the icon CDN). */
	icons: bool(env.HUB_ICONS, true)
};

export type Config = typeof config;
