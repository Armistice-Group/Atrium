export type Health = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface Icon {
	/** For light backgrounds. */
	light: string;
	/** For dark backgrounds, when the icon has a separate variant. */
	dark: string;
}

export interface Service {
	id: string;
	name: string;
	url: string;
	host: string;
	group: string;
	description: string;
	icon: Icon | null;
	health: Health;
	/** Pangolin sites its targets run on; empty for services.yaml links. */
	sites: ServiceSite[];
	/** Spans two columns. */
	wide: boolean;
	source: 'pangolin' | 'file';
	/** Changes made with the tile's edit button, to prefill the form. */
	edit: ServiceEdit | null;
}

export interface ServiceSite {
	name: string;
	/** Null for Pangolin's local site, which has no tunnel to be up or down. */
	online: boolean | null;
}

/** A tile's look, changed in the UI. Empty fields keep what Pangolin or services.yaml says. */
export interface ServiceEdit {
	name?: string;
	icon?: string;
	group?: string;
	description?: string;
	hidden?: boolean;
	wide?: boolean;
}

/** A Pangolin connection as the browser sees it: never the key itself. */
export interface ConnectionView {
	id: string;
	name: string;
	url: string;
	org: string;
	enabled: boolean;
	/** Last four characters of the key, to tell keys apart. */
	keyHint: string;
	/** "env" connections come from PANGOLIN_* variables and can only be changed there. */
	source: 'env' | 'ui';
	status: { error: string | null; lastGood: string | null; count: number } | null;
}

export interface Viewer {
	name: string;
	email: string;
	username: string;
	role: string;
}

export interface Hub {
	title: string;
	services: Service[];
	/** Group names in display order. */
	groups: string[];
	/** Why the list may be stale or empty, for the banner. */
	error: string | null;
	updatedAt: string | null;
	pangolin: boolean;
	newTab: boolean;
}
