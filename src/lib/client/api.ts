/** Calls one of the hub's JSON endpoints; throws with the server's message when it says no. */
export async function send<T = { ok: true }>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body === undefined ? {} : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as { message?: string }).message ?? `The hub answered ${res.status}`);
	return data as T;
}

/** dashboard-icons, as the server resolves them (see icons.ts). */
const CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons';

/** Where an icon field's value might load from, best guess first: for previews in the edit form. */
export function iconCandidates(value: string): string[] {
	const v = value.trim();
	if (!v) return [];
	if (/^(https?:)?\/\//i.test(v) || v.startsWith('/')) return [v];
	const slug = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return [`${CDN}/svg/${slug}.svg`, `${CDN}/png/${slug}.png`];
}
