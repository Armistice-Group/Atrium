import { error, type RequestEvent } from '@sveltejs/kit';

/**
 * Settings changes: admins only, and JSON only. A JSON body can't be sent from another site
 * without a CORS preflight, which the hub never answers, so this also stops cross-site requests.
 */
export async function adminBody(event: RequestEvent): Promise<unknown> {
	if (!event.locals.admin) error(403, 'Only the people in HUB_ADMINS can change settings.');
	if (!event.request.headers.get('content-type')?.startsWith('application/json')) error(415, 'Send JSON.');
	try {
		return await event.request.json();
	} catch {
		error(400, 'That wasn’t valid JSON.');
	}
}
