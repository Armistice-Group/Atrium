import type { Handle } from '@sveltejs/kit/hooks';

/**
 * Pangolin signs people in before they reach the hub and passes who they are in Remote-* headers
 * (it strips any a client sends). They're only used to greet the viewer: access to each service is
 * still checked by Pangolin when it's opened.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const h = event.request.headers;
	const name = h.get('remote-name') ?? '';
	const email = h.get('remote-email') ?? '';
	const username = h.get('remote-user') ?? '';
	event.locals.viewer = name || email || username ? { name, email, username, role: h.get('remote-role') ?? '' } : null;
	const res = await resolve(event);
	res.headers.set('x-frame-options', 'DENY');
	res.headers.set('referrer-policy', 'same-origin');
	return res;
};
