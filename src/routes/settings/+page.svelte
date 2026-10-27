<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { ArrowLeft, Plus, Pencil, Trash2, Cable, EyeOff, Eye, TriangleAlert, Moon, Sun } from '@lucide/svelte';
	import ConnectionForm from '#lib/components/ConnectionForm.svelte';
	import GroupList from '#lib/components/GroupList.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import Switch from '#lib/components/Switch.svelte';
	import { send } from '#lib/client/api.ts';
	import { confirmAction, setTheme, theme, toast } from '#lib/client/state.svelte.ts';
	import type { ConnectionView } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let editing = $state<ConnectionView | 'new' | null>(null);

	$effect(() => {
		theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	});

	async function setEnabled(c: ConnectionView, enabled: boolean) {
		try {
			await send('PUT', `/api/connections/${c.id}`, { name: c.name, url: c.url, org: c.org, key: '', enabled });
			await Promise.all([invalidate('hub:settings'), invalidate('hub:services')]);
		} catch (err) {
			toast('error', 'Couldn’t change it', (err as Error).message);
		}
	}

	async function remove(c: ConnectionView) {
		const ok = await confirmAction({
			title: `Remove ${c.name}?`,
			body: 'Its services leave the page, and the API key is deleted from the hub. The key itself still works in Pangolin until you delete it there.',
			detail: `${c.url}${c.org ? ` · ${c.org}` : ''}`,
			confirmLabel: 'Remove',
			danger: true
		});
		if (!ok) return;
		try {
			await send('DELETE', `/api/connections/${c.id}`);
			await Promise.all([invalidate('hub:settings'), invalidate('hub:services')]);
			toast('success', `${c.name} removed`);
		} catch (err) {
			toast('error', 'Couldn’t remove it', (err as Error).message);
		}
	}

	/** Keeps the tile's other edits (icon, name…). */
	async function unhide({ id, name, edit }: (typeof data.hidden)[number]) {
		try {
			await send('PUT', `/api/services/${encodeURIComponent(id)}`, { ...edit, hidden: false });
			await Promise.all([invalidate('hub:settings'), invalidate('hub:services')]);
			toast('success', `${name} is back`);
		} catch (err) {
			toast('error', 'Couldn’t show it', (err as Error).message);
		}
	}

	function since(iso: string | null) {
		if (!iso) return '';
		const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
		return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
	}
</script>

<svelte:head><title>Settings · {data.title}</title></svelte:head>

<div class="glow-top min-h-dvh">
	<header class="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
		<div class="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
			<a href="/" class="btn btn-ghost btn-icon -ml-2" title="Back to the hub" aria-label="Back to the hub"><ArrowLeft /></a>
			<a href="/" class="flex items-center gap-2.5">
				<Logo size={26} />
				<span class="text-[0.9375rem] font-semibold tracking-tight">Atrium</span>
			</a>
			<button class="btn btn-ghost btn-icon ml-auto" title="Switch theme" aria-label="Switch theme" onclick={() => setTheme(theme.value === 'dark' ? 'light' : 'dark')}>
				{#if theme.value === 'dark'}<Sun />{:else}<Moon />{/if}
			</button>
		</div>
	</header>

	<main class="mx-auto max-w-3xl space-y-10 px-4 pt-8 pb-16 sm:px-6">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
			<p class="mt-1 text-[0.8125rem] text-muted-foreground">Where the hub finds your services, how they’re grouped, and tiles you’ve hidden.</p>
		</div>

		{#if !data.adminsSet}
			<div class="card flex items-start gap-3 border-warning/40 p-4 text-[0.8125rem]">
				<TriangleAlert class="mt-0.5 size-4 shrink-0 text-warning" />
				<p class="text-muted-foreground">
					<span class="font-medium text-foreground">Anyone who can open the hub can change these.</span> To limit it, set
					<code class="font-mono text-xs text-foreground">HUB_ADMINS=you@example.com</code> in compose.yaml (emails or usernames from Pangolin’s sign-in, comma-separated).
				</p>
			</div>
		{/if}

		<section class="space-y-3">
			<div class="flex items-end justify-between gap-3">
				<div>
					<h2 class="text-[0.9375rem] font-semibold tracking-tight">Pangolin connections</h2>
					<p class="mt-0.5 text-[0.8125rem] text-muted-foreground">Each one adds its HTTP resources to the page. Keys are kept on the hub and never sent to the browser.</p>
				</div>
				{#if data.connections.length}<button class="btn btn-primary shrink-0" onclick={() => (editing = 'new')}><Plus />Add</button>{/if}
			</div>

			{#if !data.connections.length}
				<div class="card p-8 text-center">
					<span class="mx-auto grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><Cable class="size-5" /></span>
					<p class="mx-auto mt-3 max-w-sm text-[0.8125rem] text-muted-foreground">Connect Pangolin Cloud or your own Pangolin, and every web service you publish shows up here.</p>
					<button class="btn btn-primary mt-4" onclick={() => (editing = 'new')}><Plus />Add a connection</button>
				</div>
			{:else}
				<div class="card divide-y divide-border">
					{#each data.connections as c (c.id)}
						{@const s = c.status}
						<div class="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-medium text-[0.875rem]">{c.name}</span>
									{#if !c.enabled}
										<span class="badge">Off</span>
									{:else if !s}
										<span class="badge">Not checked yet</span>
									{:else if s.error}
										<span class="badge badge-danger"><span class="size-1.5 rounded-full bg-danger"></span>Error</span>
									{:else}
										<span class="badge badge-success"><span class="size-1.5 rounded-full bg-success"></span>{s.count} {s.count === 1 ? 'service' : 'services'}</span>
									{/if}
									{#if c.source === 'env'}<span class="badge badge-primary" title="Set by PANGOLIN_* in compose.yaml">From environment</span>{/if}
								</div>
								<p class="mt-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
									{c.url}{c.org ? ` · ${c.org}` : ''} · key …{c.keyHint}{#if s?.lastGood && !s.error}{` · checked ${since(s.lastGood)}`}{/if}
								</p>
								{#if c.enabled && s?.error}<p class="mt-1.5 text-xs break-words text-danger">{s.error}</p>{/if}
							</div>
							{#if c.source === 'ui'}
								<div class="flex items-center gap-1">
									<Switch checked={c.enabled} label={c.enabled ? `Turn off ${c.name}` : `Turn on ${c.name}`} onchange={(v) => setEnabled(c, v)} />
									<button class="btn btn-ghost btn-icon btn-sm ml-2" title="Edit" aria-label="Edit {c.name}" onclick={() => (editing = c)}><Pencil /></button>
									<button class="btn btn-ghost btn-icon btn-sm hover:text-danger" title="Remove" aria-label="Remove {c.name}" onclick={() => remove(c)}><Trash2 /></button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="space-y-3">
			<div>
				<h2 class="text-[0.9375rem] font-semibold tracking-tight">Groups</h2>
				<p class="mt-0.5 text-[0.8125rem] text-muted-foreground">
					Drag to reorder, or rename and remove groups. To move one tile to another group, use its edit button. Renaming here doesn’t change labels in Pangolin.
				</p>
			</div>
			<GroupList groups={data.groups} customOrder={data.customOrder} defaultGroup={data.defaultGroup} />
		</section>

		<section class="space-y-3">
			<div>
				<h2 class="text-[0.9375rem] font-semibold tracking-tight">Hidden tiles</h2>
				<p class="mt-0.5 text-[0.8125rem] text-muted-foreground">Tiles hidden with their edit button. To change a tile’s icon or name, hover it on the hub and press the pencil.</p>
			</div>
			{#if data.hidden.length}
				<div class="card divide-y divide-border">
					{#each data.hidden as h (h.id)}
						<div class="flex items-center gap-3 px-4 py-2.5">
							<EyeOff class="size-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate text-[0.8125rem]">{h.name}</span>
							<button class="btn btn-secondary btn-sm" onclick={() => unhide(h)}><Eye />Show</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-[0.8125rem] text-muted-foreground/80">None.</p>
			{/if}
		</section>
	</main>
</div>

<ConnectionForm bind:editing />
