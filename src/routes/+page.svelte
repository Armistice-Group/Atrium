<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { Search, Moon, Sun, Star, CircleAlert, LayoutGrid } from '@lucide/svelte';
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

	$effect(() => {
		theme.value = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
		const h = new Date().getHours();
		greeting = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
		try {
			pins = JSON.parse(localStorage.getItem('hub-pins') ?? '[]');
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

	/** Name matches beat host matches; prefixes beat substrings. */
	function score(s: Service, q: string): number {
		const name = s.name.toLowerCase();
		if (name.startsWith(q)) return 0;
		if (name.split(/[\s\-_.]+/).some((w) => w.startsWith(q))) return 1;
		if (name.includes(q)) return 2;
		if (s.host.toLowerCase().includes(q)) return 3;
		if (`${s.group} ${s.description}`.toLowerCase().includes(q)) return 4;
		return -1;
	}
	const results = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return hub.services
			.map((s) => ({ s, n: score(s, q) }))
			.filter((r) => r.n >= 0)
			.sort((a, b) => a.n - b.n || a.s.name.localeCompare(b.s.name))
			.map((r) => r.s);
	});
	$effect(() => {
		void query;
		selected = 0;
	});

	const pinned = $derived(pins.map((id) => hub.services.find((s) => s.id === id)).filter((s): s is Service => !!s));
	const byGroup = $derived(hub.groups.map((g) => ({ name: g, services: hub.services.filter((s) => s.group === g) })));
	const down = $derived(hub.services.filter((s) => s.health === 'unhealthy').length);

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
	const updated = $derived(hub.updatedAt ? new Date(hub.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);
</script>

<svelte:head><title>{hub.title}</title></svelte:head>
<svelte:window onkeydown={onWindowKey} />

{#snippet tile(s: Service, active = false)}
	{@const isPinned = pins.includes(s.id)}
	<div class="group relative">
		<a
			href={s.url}
			target={hub.newTab ? '_blank' : undefined}
			rel="noopener"
			class="card flex min-w-0 items-center gap-3 p-3 transition-all hover:-translate-y-px hover:bg-accent/60 hover:shadow-surface-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none {active ? 'ring-2 ring-primary/60' : ''}"
			title={s.description || s.url}
		>
			<ServiceIcon service={s} />
			<span class="min-w-0 flex-1">
				<span class="flex items-center gap-1.5">
					<span class="truncate text-[0.8125rem] font-medium">{s.name}</span>
					{#if DOT[s.health]}<span class="size-1.5 shrink-0 rounded-full {DOT[s.health]} {s.health === 'unhealthy' ? 'shadow-[0_0_6px] shadow-danger' : ''}" title={HEALTH_LABEL[s.health]}></span>{/if}
				</span>
				<span class="block truncate font-mono text-[0.6875rem] text-muted-foreground">{s.description || s.host}</span>
			</span>
		</a>
		<button
			class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground {isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
			title={isPinned ? 'Unpin' : 'Pin to the top'}
			aria-label={isPinned ? `Unpin ${s.name}` : `Pin ${s.name}`}
			onclick={() => togglePin(s)}
		>
			<Star class="size-3.5 {isPinned ? 'fill-warning text-warning' : ''}" />
		</button>
	</div>
{/snippet}

{#snippet section(title: string, services: Service[])}
	<section>
		<h2 class="mb-2.5 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
			{title}<span class="font-mono font-normal text-muted-foreground/70">{services.length}</span>
		</h2>
		<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each services as s (s.id)}{@render tile(s)}{/each}
		</div>
	</section>
{/snippet}

<div class="glow-top min-h-dvh">
	<header class="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
			<a href="/" class="flex items-center gap-2.5">
				<Logo size={26} />
				<span class="hidden text-[0.9375rem] font-semibold tracking-tight sm:inline">hub<span class="text-primary">·</span>modern</span>
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
			<button class="btn btn-ghost btn-icon" title="Switch theme" aria-label="Switch theme" onclick={() => setTheme(theme.value === 'dark' ? 'light' : 'dark')}>
				{#if theme.value === 'dark'}<Sun />{:else}<Moon />{/if}
			</button>
		</div>
	</header>

	<main class="mx-auto max-w-6xl space-y-8 px-4 pt-8 pb-16 sm:px-6">
		{#if query.trim()}
			<section>
				<h2 class="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					{results.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : 'No matches'}
					{#if results.length}<span class="ml-2 font-normal tracking-normal normal-case">↵ to open, ↑↓ to choose</span>{/if}
				</h2>
				<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each results as s, i (s.id)}{@render tile(s, i === selected)}{/each}
				</div>
			</section>
		{:else}
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
					<p class="mt-1 text-[0.8125rem] text-muted-foreground">
						{hub.services.length} {hub.services.length === 1 ? 'service' : 'services'}{#if down}{' · '}<span class="text-danger">{down} down</span>{/if}{#if updated && hub.pangolin}{` · updated ${updated}`}{/if}
					</p>
				</div>
			</div>

			{#if hub.error}
				<div class="card flex items-start gap-3 border-warning/40 p-4 text-[0.8125rem]">
					<CircleAlert class="mt-0.5 size-4 shrink-0 text-warning" />
					<div>
						<p class="font-medium">{hub.services.length ? 'Showing the last list we got' : 'Nothing to show yet'}</p>
						<p class="text-xs text-muted-foreground">{hub.error}</p>
					</div>
				</div>
			{/if}

			{#if !hub.services.length && !hub.error}
				<div class="card mx-auto max-w-md p-8 text-center">
					<span class="mx-auto grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><LayoutGrid class="size-5" /></span>
					<p class="mt-3 text-[0.8125rem] text-muted-foreground">No web services yet. Add HTTP resources in Pangolin, or list links in services.yaml.</p>
				</div>
			{/if}

			{#if pinned.length}{@render section('Pinned', pinned)}{/if}
			{#each byGroup as g (g.name)}{@render section(g.name, g.services)}{/each}
		{/if}
	</main>

	<footer class="mx-auto max-w-6xl px-4 pb-8 font-mono text-[0.6875rem] text-muted-foreground/70 sm:px-6">v{__APP_VERSION__}</footer>
</div>
