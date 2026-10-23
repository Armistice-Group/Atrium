<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { GripVertical, ChevronUp, ChevronDown, Pencil, Trash2, Check, X } from '@lucide/svelte';
	import { send } from '#lib/client/api.ts';
	import { confirmAction, toast } from '#lib/client/state.svelte.ts';

	let { groups, customOrder, defaultGroup }: { groups: { name: string; count: number }[]; customOrder: boolean; defaultGroup: string } = $props();

	/** The list as shown, reordered locally while dragging and saved on drop. */
	let order = $state<string[]>([]);
	let dragging = $state<string | null>(null);
	let renaming = $state<string | null>(null);
	let newName = $state('');

	$effect(() => {
		const names = groups.map((g) => g.name);
		if (!dragging) order = names;
	});
	const count = (name: string) => groups.find((g) => g.name === name)?.count ?? 0;

	async function refresh() {
		await Promise.all([invalidate('hub:settings'), invalidate('hub:services')]);
	}

	/** An empty list goes back to the default order. */
	async function saveOrder(next: string[]) {
		if (next.length) order = next;
		try {
			await send('PUT', '/api/groups', { order: next });
			await refresh();
		} catch (err) {
			toast('error', 'Couldn’t save the order', (err as Error).message);
			order = groups.map((g) => g.name);
		}
	}

	function move(name: string, by: number) {
		const i = order.indexOf(name);
		const j = i + by;
		if (j < 0 || j >= order.length) return;
		const next = [...order];
		[next[i], next[j]] = [next[j], next[i]];
		saveOrder(next);
	}

	function onDragOver(e: DragEvent, over: string) {
		if (!dragging || dragging === over) return;
		e.preventDefault();
		const next = order.filter((g) => g !== dragging);
		next.splice(next.indexOf(over) + (order.indexOf(dragging) < order.indexOf(over) ? 1 : 0), 0, dragging);
		order = next;
	}

	function onDragEnd() {
		if (!dragging) return;
		dragging = null;
		if (order.join('\n') !== groups.map((g) => g.name).join('\n')) saveOrder(order);
	}

	function startRename(name: string) {
		renaming = name;
		newName = name;
	}

	async function rename() {
		const from = renaming!;
		const to = newName.trim();
		renaming = null;
		if (!to || to === from) return;
		try {
			await send('POST', '/api/groups', { from, to });
			await refresh();
			toast('success', `Renamed to ${to}`);
		} catch (err) {
			toast('error', 'Couldn’t rename it', (err as Error).message);
		}
	}

	async function remove(name: string) {
		const n = count(name);
		const ok = await confirmAction({
			title: `Remove ${name}?`,
			body: `Its ${n} ${n === 1 ? 'tile moves' : 'tiles move'} to ${defaultGroup}. Nothing changes in Pangolin.`,
			confirmLabel: 'Remove group',
			danger: true
		});
		if (!ok) return;
		try {
			await send('POST', '/api/groups', { from: name });
			await refresh();
			toast('success', `${name} removed`);
		} catch (err) {
			toast('error', 'Couldn’t remove it', (err as Error).message);
		}
	}
</script>

{#if order.length}
	<div class="card divide-y divide-border" role="list">
		{#each order as name, i (name)}
			<div
				role="listitem"
				class="flex items-center gap-2 py-2 pr-3 pl-2 transition-colors {dragging === name ? 'bg-primary-soft' : ''}"
				draggable={renaming !== name}
				ondragstart={(e) => {
					dragging = name;
					e.dataTransfer?.setData('text/plain', name);
				}}
				ondragover={(e) => onDragOver(e, name)}
				ondrop={(e) => e.preventDefault()}
				ondragend={onDragEnd}
			>
				<GripVertical class="size-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden="true" />
				{#if renaming === name}
					<form class="flex min-w-0 flex-1 items-center gap-1.5" onsubmit={(e) => (e.preventDefault(), rename())}>
						<!-- svelte-ignore a11y_autofocus -->
						<input class="input h-8 text-[0.8125rem]" bind:value={newName} aria-label="New name for {name}" autofocus onkeydown={(e) => e.key === 'Escape' && (renaming = null)} />
						<button class="btn btn-ghost btn-icon btn-sm" type="submit" aria-label="Save name"><Check /></button>
						<button class="btn btn-ghost btn-icon btn-sm" type="button" aria-label="Cancel" onclick={() => (renaming = null)}><X /></button>
					</form>
				{:else}
					<span class="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{name}</span>
					<span class="font-mono text-[0.6875rem] text-muted-foreground">{count(name)}</span>
					<div class="ml-2 flex items-center">
						<button class="btn btn-ghost btn-icon btn-sm" disabled={i === 0} aria-label="Move {name} up" onclick={() => move(name, -1)}><ChevronUp /></button>
						<button class="btn btn-ghost btn-icon btn-sm" disabled={i === order.length - 1} aria-label="Move {name} down" onclick={() => move(name, 1)}><ChevronDown /></button>
						<button class="btn btn-ghost btn-icon btn-sm" title="Rename" aria-label="Rename {name}" onclick={() => startRename(name)}><Pencil /></button>
						<button
							class="btn btn-ghost btn-icon btn-sm hover:text-danger"
							title={name === defaultGroup ? 'Ungrouped tiles go here, so it can’t be removed' : 'Remove'}
							aria-label="Remove {name}"
							disabled={name === defaultGroup}
							onclick={() => remove(name)}><Trash2 /></button
						>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	{#if customOrder}
		<button class="btn btn-ghost btn-sm" onclick={() => saveOrder([])}>Reset to the default order</button>
	{/if}
{:else}
	<p class="text-[0.8125rem] text-muted-foreground/80">No groups yet: they appear once there are tiles.</p>
{/if}
