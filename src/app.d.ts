import type { Viewer } from '#lib/types.ts';

declare global {
	const __APP_VERSION__: string;
	namespace App {
		interface Locals {
			viewer: Viewer | null;
			/** May change connections and tiles (HUB_ADMINS). */
			admin: boolean;
		}
	}
}

export {};
