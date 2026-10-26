<script lang="ts">
	let { size = 28 }: { size?: number } = $props();
	// Gradient ids must be unique per instance; the logo appears more than once on some pages.
	const id = $props.id();

	/** Four raised app tiles turning around the hub, lightest at the top left. */
	const blades = [
		{ x: 3, y: 2.2, w: 14, h: 8, from: '#ddd6fe', to: '#a78bfa', edge: '#8b5cf6' },
		{ x: 21, y: 2.2, w: 8, h: 14, from: '#c4b5fd', to: '#8b5cf6', edge: '#7c3aed' },
		{ x: 15, y: 20.2, w: 14, h: 8, from: '#a78bfa', to: '#7c3aed', edge: '#6d28d9' },
		{ x: 3, y: 14.2, w: 8, h: 14, from: '#8b5cf6', to: '#5b21b6', edge: '#5b21b6' }
	];
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="shrink-0">
	<defs>
		{#each blades as b, i (i)}
			<linearGradient id="{id}-{i}" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color={b.from} />
				<stop offset="1" stop-color={b.to} />
			</linearGradient>
		{/each}
		<linearGradient id="{id}-sheen" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff" stop-opacity="0.35" />
			<stop offset="0.6" stop-color="#fff" stop-opacity="0" />
		</linearGradient>
	</defs>
	{#each blades as b, i (i)}
		<rect x={b.x} y={b.y + 1.6} width={b.w} height={b.h} rx="2.4" fill={b.edge} />
		<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2.4" fill="url(#{id}-{i})" />
		<rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2.4" fill="url(#{id}-sheen)" />
	{/each}
	<!-- The hub: deep violet on light backgrounds, white on dark. -->
	<rect x="13.6" y="14.1" width="4.8" height="4.8" rx="1.5" class="fill-[#2e1065] dark:fill-[#6d28d9]" />
	<rect x="13.6" y="12.8" width="4.8" height="4.8" rx="1.5" class="fill-[#5b21b6] dark:fill-white" />
</svg>
