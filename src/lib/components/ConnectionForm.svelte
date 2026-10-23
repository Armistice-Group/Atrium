<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { CircleCheck, CircleAlert, LoaderCircle } from '@lucide/svelte';
	import Dialog from './Dialog.svelte';
	import Switch from './Switch.svelte';
	import { send } from '#lib/client/api.ts';
	import { toast } from '#lib/client/state.svelte.ts';
	import type { ConnectionView } from '#lib/types.ts';

	/** `editing` is the connection being changed, or "new"; null when closed. */
	let { editing = $bindable() }: { editing: ConnectionView | 'new' | null } = $props();

	const PRESETS = [
		{ id: 'cloud', label: 'Pangolin Cloud', url: 'https://api.pangolin.net/v1', hint: 'Your org on app.pangolin.net.' },
		{ id: 'docker', label: 'Self-hosted, same Docker network', url: 'http://pangolin:3003/v1', hint: 'Needs enable_integration_api in Pangolin’s config.yml, and the hub on Pangolin’s network.' },
		{ id: 'custom', label: 'Other URL', url: '', hint: 'e.g. https://api.yourdomain/v1 if you’ve published the API.' }
	] as const;

	let name = $state('');
	let url = $state('');
	let key = $state('');
	let org = $state('');
	let enabled = $state(true);
	let preset = $state<(typeof PRESETS)[number]['id']>('cloud');
	let busy = $state<'test' | 'save' | null>(null);
	let result = $state<{ ok: true; count: number; total: number } | { ok: false; error: string } | null>(null);

	const existing = $derived(editing && editing !== 'new' ? editing : null);

	let openedFor: string | null = null;
	$effect(() => {
		const id = editing === 'new' ? 'new' : (editing?.id ?? null);
		if (id === openedFor) return;
		openedFor = id;
		if (!editing) return;
		const c = editing === 'new' ? null : editing;
		name = c?.name ?? '';
		url = c?.url ?? PRESETS[0].url;
		key = '';
		org = c?.org ?? '';
		enabled = c?.enabled ?? true;
		preset = PRESETS.find((p) => p.url && p.url === url)?.id ?? 'custom';
		result = null;
	});

	function pick(id: (typeof PRESETS)[number]['id']) {
		preset = id;
		const p = PRESETS.find((p) => p.id === id)!;
		if (p.url) url = p.url;
		result = null;
	}

	const body = () => ({ id: existing?.id, name: name || (preset === 'cloud' ? 'Pangolin Cloud' : ''), url, key, org, enabled });

	async function test() {
		busy = 'test';
		result = null;
		try {
			result = await send('POST', '/api/connections/test', body());
		} catch (err) {
			result = { ok: false, error: (err as Error).message };
		} finally {
			busy = null;
		}
	}

	async function save() {
		busy = 'save';
		try {
			if (existing) await send('PUT', `/api/connections/${existing.id}`, body());
			else await send('POST', '/api/connections', body());
			await Promise.all([invalidate('hub:settings'), invalidate('hub:services')]);
			toast('success', existing ? 'Connection saved' : 'Connection added');
			editing = null;
		} catch (err) {
			toast('error', 'Couldn’t save', (err as Error).message);
		} finally {
			busy = null;
		}
	}
</script>

<Dialog bind:open={() => !!editing, (v) => !v && (editing = null)} title={existing ? `Edit ${existing.name}` : 'Add a Pangolin connection'} width="max-w-xl">
	<form id="connection" class="space-y-4" onsubmit={(e) => (e.preventDefault(), save())}>
		<fieldset>
			<legend class="label">Where’s Pangolin?</legend>
			<div class="grid gap-2 sm:grid-cols-3">
				{#each PRESETS as p (p.id)}
					<button
						type="button"
						class="rounded-lg border px-3 py-2 text-left text-[0.8125rem] transition-colors {preset === p.id ? 'border-primary bg-primary-soft text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
						aria-pressed={preset === p.id}
						onclick={() => pick(p.id)}>{p.label}</button
					>
				{/each}
			</div>
			<p class="mt-1.5 text-xs text-muted-foreground">{PRESETS.find((p) => p.id === preset)?.hint}</p>
		</fieldset>

		<div>
			<label class="label" for="conn-url">API URL</label>
			<input id="conn-url" class="input font-mono text-[0.8125rem]" bind:value={url} oninput={() => (preset = PRESETS.find((p) => p.url === url)?.id ?? 'custom')} placeholder="https://api.pangolin.net/v1" required autocomplete="off" spellcheck="false" />
		</div>

		<div>
			<label class="label" for="conn-key">API key</label>
			<input
				id="conn-key"
				class="input font-mono text-[0.8125rem]"
				type="password"
				bind:value={key}
				placeholder={existing ? `Saved key ends in ${existing.keyHint}: leave empty to keep it` : 'Paste the key Pangolin showed you'}
				required={!existing}
				autocomplete="off"
			/>
			<p class="mt-1.5 text-xs text-muted-foreground">In Pangolin: your organisation → <b>API Keys</b> → <b>Create API Key</b>, with only <b>List Resources</b> ticked.</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label class="label" for="conn-org">Organisation ID</label>
				<input id="conn-org" class="input font-mono text-[0.8125rem]" bind:value={org} placeholder="home-lab" autocomplete="off" spellcheck="false" />
				<p class="mt-1.5 text-xs text-muted-foreground">The first part of the path in Pangolin’s address bar.</p>
			</div>
			<div>
				<label class="label" for="conn-name">Name</label>
				<input id="conn-name" class="input" bind:value={name} placeholder={preset === 'cloud' ? 'Pangolin Cloud' : 'Home lab'} autocomplete="off" />
			</div>
		</div>

		<div class="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-3 py-2.5">
			<div>
				<p class="text-[0.8125rem] font-medium">Show its services</p>
				<p class="text-xs text-muted-foreground">Turn off to keep the connection without using it.</p>
			</div>
			<Switch bind:checked={enabled} label="Show its services" />
		</div>

		{#if result}
			<div class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[0.8125rem] {result.ok ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}">
				{#if result.ok}
					<CircleCheck class="mt-0.5 size-4 shrink-0 text-success" />
					<p>Connected. {result.count} of {result.total} {result.total === 1 ? 'resource' : 'resources'} can be opened in a browser and will show as tiles.</p>
				{:else}
					<CircleAlert class="mt-0.5 size-4 shrink-0 text-danger" />
					<p class="min-w-0 break-words">{result.error}</p>
				{/if}
			</div>
		{/if}
	</form>
	{#snippet footer()}
		<button class="btn btn-secondary mr-auto" type="button" disabled={!!busy || !url || (!key && !existing)} onclick={test}>
			{#if busy === 'test'}<LoaderCircle class="animate-spin" />{/if}Test
		</button>
		<button class="btn btn-ghost" type="button" onclick={() => (editing = null)}>Cancel</button>
		<button class="btn btn-primary" type="submit" form="connection" disabled={!!busy}>
			{#if busy === 'save'}<LoaderCircle class="animate-spin" />{/if}{existing ? 'Save' : 'Add connection'}
		</button>
	{/snippet}
</Dialog>
