<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { Search, Moon, Sun, Star, CircleAlert, LayoutGrid, Pencil, Settings } from '@lucide/svelte';
	import EditTile from '#lib/components/EditTile.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import ServiceIcon from '#lib/components/ServiceIcon.svelte';
	import { setTheme, theme } from '#lib/client/state.svelte.ts';
	import type { Health, Service } from '#lib/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hub = $derived(data.hub);

	let query = $state('');
	let selected = $state(0);
	let input: HTMLInputElement;
	let pins = $state<string[]>([]);
	let greeting = $state('Hello');
	let size = $state<Size>('large');
	const large = $derived(size === 'large');
	let editing = $state<Service | null>(null);
	let groupBy = $state<'label' | 'site'>('label');
	let siteFilter = $state<string | null>(null);

	$effect(() => {
		theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
		const h = new Date().getHours();
		greeting = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
		try {
			pins = JSON.parse(localStorage.getItem('hub-pins') ?? '[]');
			const saved = localStorage.getItem('hub-size');
			size = saved === 'small' || saved === 'medium' ? saved : 'large';
			groupBy = localStorage.getItem('hub-group') === 'site' ? 'site' : 'label';
		} catch {}
		// Status dots and new services show up without a reload.
		const timer = setInterval(() => document.visibilityState === 'visible' && invalidate('hub:services'), 30_000);
		return () => clearInterval(timer);
	});

	function togglePin(s: Service) {
		pins = pins.includes(s.id) ? pins.filter((id) => id !== s.id) : [...pins, s.id];
		try {
			localStorage.setItem('hub-pins', JSON.stringify(pins));
		} catch {}
	}

	type Size = 'small' | 'medium' | 'large';
	function setSize(v: Size) {
		size = v;
		try {
			localStorage.setItem('hub-size', v);
		} catch {}
	}

	function setGroupBy(v: 'label' | 'site') {
		groupBy = v;
		try {
			localStorage.setItem('hub-group', v);
		} catch {}
	}

	/** services.yaml links, and resources Pangolin gives no site for. */
	const NO_SITE = 'No site';
	const siteNames = (s: Service) => (s.sites.length ? s.sites.map((x) => x.name) : [NO_SITE]);

	/** Every site with how many tiles it has, A–Z, with "No site" last. */
	const sites = $derived.by(() => {
		const map = new Map<string, { name: string; online: boolean | null; count: number }>();
		for (const s of hub.services) {
			for (const name of siteNames(s)) {
				const entry = map.get(name) ?? { name, online: null, count: 0 };
				entry.count++;
				entry.online ??= s.sites.find((x) => x.name === name)?.online ?? null;
				map.set(name, entry);
			}
		}
		return [...map.values()].sort((a, b) => (a.name === NO_SITE ? 1 : b.name === NO_SITE ? -1 : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
	});
	// A site that's gone (removed, or its connection turned off) stops filtering.
	const activeSite = $derived(siteFilter && sites.some((x) => x.name === siteFilter) ? siteFilter : null);
	const visible = $derived(activeSite ? hub.services.filter((s) => siteNames(s).includes(activeSite)) : hub.services);

	/** Name matches beat host matches; prefixes beat substrings. */
	function score(s: Service, q: string): number {
		const name = s.name.toLowerCase();
		if (name.startsWith(q)) return 0;
		if (name.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 1;
		if (name.includes(q)) return 2;
		if (s.host.toLowerCase().includes(q)) return 3;
		if (`${s.group} ${s.description} ${s.sites.map((x) => x.name).join(' ')}`.toLowerCase().includes(q)) return 4;
		return -1;
	}
	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return visible
			.map((s) => ({ s, n: score(s, q) }))
			.filter((r) => r.n >= 0)
			.sort((a, b) => a.n - b.n || a.s.name.localeCompare(b.s.name))
			.map((r) => r.s);
	});
	$effect(() => {
		void query;
		selected = 0;
	});

	const pinned = $derived(pins.map((id) => visible.find((s) => s.id === id)).filter((s): s is Service => !!s));
	/** Sections: Pangolin labels (groups), or sites, where a service on two sites shows under both. */
	const sections = $derived.by(() => {
		const list =
			groupBy === 'site'
				? sites.map((x) => ({ name: x.name, online: x.online, services: visible.filter((s) => siteNames(s).includes(x.name)) }))
				: hub.groups.map((g) => ({ name: g, online: null, services: visible.filter((s) => s.group === g) }));
		return list.filter((x) => x.services.length);
	});
	const down = $derived(visible.filter((s) => s.health === 'unhealthy').length);

	function open(s: Service, newTab = hub.newTab) {
		if (newTab) window.open(s.url, '_blank', 'noopener');
		else location.href = s.url;
	}

	function onWindowKey(e: KeyboardEvent) {
		const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
		if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
			e.preventDefault();
			input.focus();
			input.select();
		} else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1 && /\S/.test(e.key)) {
			// Start typing anywhere to search, like a launcher.
			input.focus();
		}
	}

	function onSearchKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			query = '';
			input.blur();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (results.length) selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
		} else if (e.key === 'Enter' && results[selected]) {
			e.preventDefault();
			open(results[selected], hub.newTab !== (e.metaKey || e.ctrlKey));
			query = '';
		}
	}

	const DOT: Record<Health, string> = {
		healthy: 'bg-success',
		degraded: 'bg-warning',
		unhealthy: 'bg-danger',
		unknown: ''
	};
	const HEALTH_LABEL: Record<Health, string> = { healthy: 'Up', degraded: 'Degraded', unhealthy: 'Down', unknown: '' };
	const firstName = $derived((data.viewer?.name || data.viewer?.username || '').split(/\s+/)[0]);
	const GRID: Record<Size, string> = {
		small: 'grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6',
		medium: 'grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4',
		// App-launcher tiles, like Authentik or Okta: as many ~10rem columns as fit, with room around each.
		large: 'grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4 sm:gap-6'
	};
	// Medium is one column on phones, where a wide tile has nothing to span.
	const WIDE: Record<Size, string> = { small: 'col-span-2', medium: 'sm:col-span-2', large: 'col-span-2' };
	const gridCols = $derived(GRID[size]);
	const updated = $derived(hub.updatedAt ? new Date(hub.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
</script>

<svelte:head><title>{hub.title}</title></svelte:head>
<svelte:window onkeydown={onWindowKey} />

{#snippet tile(s: Service, active = false)}
	{@const isPinned = pins.includes(s.id)}
	{@const dot = DOT[s.health] ? `size-1.5 shrink-0 rounded-full ${DOT[s.health]} ${s.health === 'unhealthy' ? 'shadow-[0_0_6px] shadow-danger' : ''}` : ''}
	<div class="group relative {s.wide ? WIDE[size] : ''}">
		<a
			href={s.url}
			target={hub.newTab ? '_blank' : undefined}
			rel="noopener"
			class="card relative flex min-w-0 transition-all hover:-translate-y-px hover:bg-accent/60 hover:shadow-surface-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none {large
				? 'flex-col items-center gap-3.5 px-4 pt-7 pb-6 text-center'
				: size === 'small'
					? 'items-center gap-2.5 p-2'
					: 'items-center gap-3 p-3'} {active ? 'ring-2 ring-primary/60' : ''}"
			title={s.description || s.url}
		>
			{#if s.health !== 'unknown'}<span class="status-glow status-{s.health}" aria-hidden="true"></span>{/if}
			{#if large}
				<ServiceIcon service={s} size="size-16" large />
				<span class="w-full min-w-0">
					<span class="block truncate text-[0.9375rem] font-medium">{s.name}</span>
					<span class="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground">{s.description || s.host}</span>
				</span>
				{#if dot}<span class="absolute top-3 left-3 {dot}" title={HEALTH_LABEL[s.health]}></span>{/if}
			{:else if size === 'small'}
				<span class="relative shrink-0">
					<ServiceIcon service={s} size="size-8" />
					{#if dot}<span class="absolute -top-0.5 -right-0.5 ring-2 ring-card {dot}" title={HEALTH_LABEL[s.health]}></span>{/if}
				</span>
				<span class="min-w-0 truncate text-[0.8125rem] font-medium">{s.name}</span>
			{:else}
				<ServiceIcon service={s} />
				<span class="min-w-0 flex-1">
					<span class="flex items-center gap-1.5">
						<span class="truncate text-[0.8125rem] font-medium">{s.name}</span>
						{#if dot}<span class={dot} title={HEALTH_LABEL[s.health]}></span>{/if}
					</span>
					<span class="block truncate font-mono text-[0.6875rem] text-muted-foreground">{s.description || s.host}</span>
				</span>
			{/if}
		</a>
		<!-- Small tiles have no room to spare: the buttons cover the name's end, on a backdrop, while hovered. -->
		<div class="absolute right-1.5 flex gap-0.5 rounded-md {size === 'small' ? 'top-1/2 -translate-y-1/2 group-hover:bg-card' : 'top-1.5'}">
			{#if data.admin}
				<button
					class="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
					title="Edit tile"
					aria-label="Edit {s.name}"
					onclick={() => (editing = s)}
				>
					<Pencil class="size-3.5" />
				</button>
			{/if}
			<button
				class="grid size-6 place-items-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground {isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
				title={isPinned ? 'Unpin' : 'Pin to the top'}
				aria-label={isPinned ? `Unpin ${s.name}` : `Pin ${s.name}`}
				onclick={() => togglePin(s)}
			>
				<Star class="size-3.5 {isPinned ? 'fill-warning text-warning' : ''}" />
			</button>
		</div>
	</div>
{/snippet}

{#snippet siteDot(online: boolean | null)}
	{#if online !== null}<span class="size-1.5 shrink-0 rounded-full {online ? 'bg-success' : 'bg-danger shadow-[0_0_6px] shadow-danger'}" title={online ? 'Site online' : 'Site offline'}></span>{/if}
{/snippet}

{#snippet segmented(label: string, options: [string, string][], value: string, pick: (v: string) => void)}
	<div class="flex items-center gap-2">
		{label}
		<div class="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label={label}>
			{#each options as [v, text] (v)}
				<button
					class="h-6 min-w-7 rounded-md px-2.5 font-medium transition-colors {value === v ? 'bg-card text-foreground shadow-surface' : 'hover:text-foreground'}"
					aria-pressed={value === v}
					aria-label={label === 'Size' ? `${{ small: 'Small', medium: 'Medium', large: 'Large' }[v]} tiles` : undefined}
					onclick={() => pick(v)}>{text}</button
				>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet chip(label: string, value: string | null, count: number, online: boolean | null)}
	{@const on = activeSite === value}
	<button
		class="inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors {on ? 'border-primary/60 bg-primary-soft text-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'}"
		aria-pressed={on}
		aria-label="{label}: {count} {count === 1 ? 'service' : 'services'}{online === false ? ', site offline' : ''}"
		onclick={() => (siteFilter = on && value ? null : value)}
	>
		{@render siteDot(online)}{label}<span class="font-mono text-[0.6875rem] text-muted-foreground/80">{count}</span>
	</button>
{/snippet}

{#snippet section(title: string, services: Service[], online: boolean | null = null)}
	<section>
		<h2 class="mb-4 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			{#if groupBy === 'site'}{@render siteDot(online)}{/if}{title}<span class="font-mono font-normal text-muted-foreground/70">{services.length}</span>
			{#if groupBy === 'site' && online === false}<span class="font-normal tracking-normal text-danger normal-case">offline</span>{/if}
		</h2>
		<div class="grid {gridCols}">
			{#each services as s (s.id)}{@render tile(s)}{/each}
		</div>
	</section>
{/snippet}

<div class="glow-top min-h-dvh">
	<header class="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
			<a href="/" class="flex items-center gap-2.5">
				<Logo size={26} />
				<span class="hidden text-[0.9375rem] font-semibold tracking-tight sm:inline">Atrium</span>
			</a>
			<label class="relative mx-auto w-full max-w-md">
				<Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<input
					bind:this={input}
					bind:value={query}
					onkeydown={onSearchKey}
					class="input h-9 pr-12 pl-9"
					placeholder="Search {hub.services.length} services…"
					aria-label="Search services"
					autocomplete="off"
					spellcheck="false"
				/>
				<span class="kbd pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 sm:inline-flex">⌘K</span>
			</label>
			{#if data.admin}<a href="/settings" class="btn btn-ghost btn-icon" title="Settings" aria-label="Settings"><Settings /></a>{/if}
			<button class="btn btn-ghost btn-icon" title="Switch theme" aria-label="Switch theme" onclick={() => setTheme(theme.value === 'dark' ? 'light' : 'dark')}>
				{#if theme.value === 'dark'}<Sun />{:else}<Moon />{/if}
			</button>
		</div>
	</header>

	<main class="mx-auto max-w-6xl space-y-10 px-4 pt-8 pb-16 sm:px-6">
		{#if query.trim()}
			<section>
				<h2 class="mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					{results.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'No matches'}{#if activeSite}{` on ${activeSite}`}<button class="ml-2 font-normal tracking-normal text-primary normal-case hover:underline" onclick={() => (siteFilter = null)}>search all sites</button>{/if}
					{#if results.length}<span class="ml-2 font-normal tracking-normal normal-case">↵ to open, ↑↓ to choose</span>{/if}
				</h2>
				<div class="grid {gridCols}">
					{#each results as s, i (s.id)}{@render tile(s, i === selected)}{/each}
				</div>
			</section>
		{:else}
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
					<p class="mt-1 text-[0.8125rem] text-muted-foreground">
						{visible.length} {visible.length === 1 ? 'service' : 'services'}{#if activeSite}{` on ${activeSite}`}{/if}{#if down}{' · '}<span class="text-danger">{down} down</span>{/if}{#if updated && hub.pangolin}{` · updated ${updated}`}{/if}
					</p>
				</div>
			</div>

			<div class="-mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
				{#if sites.length > 1}
					<div class="flex flex-wrap gap-1.5" role="group" aria-label="Show one site">
						{@render chip('All', null, hub.services.length, null)}
						{#each sites as x (x.name)}{@render chip(x.name, x.name, x.count, x.online)}{/each}
					</div>
				{/if}
				<div class="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
					{#if sites.length > 1}
						{@render segmented('Group by', [['label', 'Label'], ['site', 'Site']], groupBy, (v) => setGroupBy(v as 'label' | 'site'))}
					{/if}
					{@render segmented('Size', [['small', 'S'], ['medium', 'M'], ['large', 'L']], size, (v) => setSize(v as Size))}
				</div>
			</div>

			{#if hub.error}
				<div class="card flex items-start gap-3 border-warning/40 p-4 text-[0.8125rem]">
					<CircleAlert class="mt-0.5 size-4 shrink-0 text-warning" />
					<div class="min-w-0 flex-1">
						<p class="font-medium">{hub.services.length ? 'Showing the last list we got' : 'Nothing to show yet'}</p>
						<p class="text-xs text-muted-foreground">{hub.error}</p>
					</div>
					{#if data.admin}<a href="/settings" class="btn btn-secondary btn-sm shrink-0">{hub.pangolin ? 'Check connections' : 'Connect Pangolin'}</a>{/if}
				</div>
			{/if}

			{#if !hub.services.length && !hub.error}
				<div class="card mx-auto max-w-md p-8 text-center">
					<span class="mx-auto grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><LayoutGrid class="size-5" /></span>
					<p class="mt-3 text-[0.8125rem] text-muted-foreground">No web services yet. Add HTTP resources in Pangolin, or list links in services.yaml.</p>
				</div>
			{/if}

			{#if pinned.length}{@render section('Pinned', pinned)}{/if}
			{#each sections as g (g.name)}{@render section(g.name, g.services, g.online)}{/each}
		{/if}
	</main>

	<EditTile bind:service={editing} groups={hub.groups} />

	<footer class="mx-auto max-w-6xl px-4 pb-8 font-mono text-[0.6875rem] text-muted-foreground/70 sm:px-6">v{__APP_VERSION__}</footer>
</div>
