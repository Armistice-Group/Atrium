<script lang="ts">
	let { size = 28 }: { size?: number } = $props();

	/** Atrium's wings: four rooms around an open court, graded from ink to light. */
	const wings = [
		{ x: 4, y: 16, w: 12, h: 32, rx: 6, fill: 'fill-[#18181b] dark:fill-[#6b6b73]' },
		{ x: 16, y: 4, w: 32, h: 12, rx: 6, fill: 'fill-[#45454c] dark:fill-[#97979f]' },
		{ x: 26, y: 26, w: 12, h: 12, rx: 4, fill: 'fill-[#5c5c64] dark:fill-[#adadb4]' },
		{ x: 16, y: 48, w: 32, h: 12, rx: 6, fill: 'fill-[#74747c] dark:fill-[#c3c3c9]' },
		{ x: 48, y: 16, w: 12, h: 32, rx: 6, fill: 'fill-[#a5a5ac] dark:fill-[#ececef]' }
	];
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" class="shrink-0">
	{#each wings as w, i (i)}
		<rect x={w.x} y={w.y} width={w.w} height={w.h} rx={w.rx} class={w.fill} />
	{/each}
</svg>
