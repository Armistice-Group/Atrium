<script lang="ts">
	import type { Service } from '#lib/types.ts';

	let { service, size = 'size-10' }: { service: Service; size?: string } = $props();
	let failed = $state(false);
	// A stable hue per name, so a service's letter tile keeps its colour.
	const hue = $derived([...service.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
</script>

{#if service.icon && !failed}
	<span class="grid {size} shrink-0 place-items-center rounded-xl border border-border bg-background/60 p-1.5">
		<img class="size-full object-contain dark:hidden" src={service.icon.light} alt="" loading="lazy" onerror={() => (failed = true)} />
		<img class="hidden size-full object-contain dark:block" src={service.icon.dark} alt="" loading="lazy" onerror={() => (failed = true)} />
	</span>
{:else}
	<span
		class="relative grid {size} shrink-0 place-items-center overflow-hidden rounded-xl text-[0.9375rem] font-semibold text-white"
		style="background: linear-gradient(135deg, oklch(70% 0.13 {hue}), oklch(50% 0.15 {hue}))"
		aria-hidden="true"
	>
		<span class="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent"></span>
		<span class="relative">{service.name.trim().slice(0, 1).toUpperCase()}</span>
	</span>
{/if}
