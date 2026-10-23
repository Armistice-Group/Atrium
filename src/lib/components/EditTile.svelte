<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { ExternalLink, ImageOff } from '@lucide/svelte';
	import Dialog from './Dialog.svelte';
	import Switch from './Switch.svelte';
	import ServiceIcon from './ServiceIcon.svelte';
	import { iconCandidates, send } from '#lib/client/api.ts';
	import { toast } from '#lib/client/state.svelte.ts';
	import type { Service } from '#lib/types.ts';

	let { service = $bindable(), groups }: { service: Service | null; groups: string[] } = $props();

	let name = $state('');
	let icon = $state('');
	let group = $state('');
	let description = $state('');
	let hidden = $state(false);
	let wide = $state(false);
	let saving = $state(false);
	let attempt = $state(0);

	// Fill the form each time a tile is opened.
	let openedFor: string | null = null;
	$effect(() => {
		if (!service || service.id === openedFor) {
			if (!service) openedFor = null;
			return;
		}
		openedFor = service.id;
		const e = service.edit ?? {};
		name = e.name ?? '';
		icon = e.icon ?? '';
		group = e.group ?? '';
		description = e.description ?? '';
		hidden = !!e.hidden;
		wide = !!e.wide;
	});

	const candidates = $derived(iconCandidates(icon));
	$effect(() => {
		void icon;
		attempt = 0;
	});
	const preview = $derived(candidates[attempt] ?? null);

	async function save() {
		if (!service) return;
		saving = true;
		try {
			await send('PUT', `/api/services/${encodeURIComponent(service.id)}`, { name, icon, group, description, hidden, wide, label: name || service.name });
			await invalidate('hub:services');
			toast('success', hidden ? `${service.name} hidden` : `${name || service.name} saved`, hidden ? 'Bring it back from Settings.' : undefined);
			service = null;
		} catch (err) {
			toast('error', 'Couldn’t save', (err as Error).message);
		} finally {
			saving = false;
		}
	}

	async function reset() {
		if (!service) return;
		saving = true;
		try {
			await send('DELETE', `/api/services/${encodeURIComponent(service.id)}`);
			await invalidate('hub:services');
			toast('success', 'Back to the original');
			service = null;
		} catch (err) {
			toast('error', 'Couldn’t reset', (err as Error).message);
		} finally {
			saving = false;
		}
	}
</script>

<Dialog bind:open={() => !!service, (v) => !v && (service = null)} title="Edit tile" description={service?.host} width="max-w-lg">
	{#if service}
		<form id="edit-tile" class="space-y-4" onsubmit={(e) => (e.preventDefault(), save())}>
			<div>
				<label class="label" for="tile-icon">Icon</label>
				<div class="flex items-center gap-3">
					{#if icon.trim()}
						{#if preview}
							<span class="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-background/60 p-2">
								<img class="size-full object-contain" src={preview} alt="" onerror={() => attempt++} />
							</span>
						{:else}
							<span class="grid size-12 shrink-0 place-items-center rounded-xl border border-dashed border-border text-muted-foreground" title="No icon by that name"><ImageOff class="size-4" /></span>
						{/if}
					{:else}
						<ServiceIcon service={{ ...service, name: name || service.name }} size="size-12" />
					{/if}
					<input id="tile-icon" class="input font-mono text-[0.8125rem]" bind:value={icon} placeholder="grafana, or https://…/logo.svg" autocomplete="off" spellcheck="false" />
				</div>
				<p class="mt-1.5 text-xs text-muted-foreground">
					A name from <a class="inline-flex items-center gap-0.5 text-primary hover:underline" href="https://dashboardicons.com" target="_blank" rel="noopener">dashboardicons.com<ExternalLink class="size-3" /></a>, or any image URL. Leave empty to pick one automatically.
				</p>
				{#if icon.trim() && !preview}<p class="mt-1 text-xs text-warning">Nothing found for “{icon.trim()}”: check the name on dashboardicons.com.</p>{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label class="label" for="tile-name">Name</label>
					<input id="tile-name" class="input" bind:value={name} placeholder={service.edit?.name ? '' : service.name} autocomplete="off" />
				</div>
				<div>
					<label class="label" for="tile-group">Group</label>
					<input id="tile-group" class="input" bind:value={group} list="tile-groups" placeholder={service.edit?.group ? '' : service.group} autocomplete="off" />
					<datalist id="tile-groups">{#each groups as g (g)}<option value={g}></option>{/each}</datalist>
				</div>
			</div>

			<div>
				<label class="label" for="tile-description">Description</label>
				<input id="tile-description" class="input" bind:value={description} placeholder="Shown instead of {service.host}" autocomplete="off" />
			</div>

			<div class="divide-y divide-border rounded-lg border border-border bg-surface">
				<div class="flex items-center justify-between gap-4 px-3 py-2.5">
					<div>
						<p class="text-[0.8125rem] font-medium">Wide tile</p>
						<p class="text-xs text-muted-foreground">Takes two columns, for the ones you open most.</p>
					</div>
					<Switch bind:checked={wide} label="Wide tile" />
				</div>
				<div class="flex items-center justify-between gap-4 px-3 py-2.5">
					<div>
						<p class="text-[0.8125rem] font-medium">Hide this tile</p>
						<p class="text-xs text-muted-foreground">Settings lists hidden tiles, so you can bring them back.</p>
					</div>
					<Switch bind:checked={hidden} label="Hide this tile" />
				</div>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		{#if service?.edit}<button class="btn btn-ghost mr-auto" disabled={saving} onclick={reset}>Reset to original</button>{/if}
		<button class="btn btn-ghost" onclick={() => (service = null)}>Cancel</button>
		<button class="btn btn-primary" type="submit" form="edit-tile" disabled={saving}>Save</button>
	{/snippet}
</Dialog>
