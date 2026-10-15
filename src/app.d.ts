import type { Viewer } from '#lib/types.ts';

declare global {
	const __APP_VERSION__: string;
	namespace App {
		interface Locals {
			viewer: Viewer | null;
		}
	}
}

export {};
