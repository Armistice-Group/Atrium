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
	source: 'pangolin' | 'file';
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
