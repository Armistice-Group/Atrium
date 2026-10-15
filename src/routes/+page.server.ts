import { buildHub } from '#lib/server/hub.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('hub:services');
	return { hub: await buildHub(), viewer: locals.viewer };
};
