<script lang="ts">
	let { size = 28 }: { size?: number } = $props();
	// Gradient ids must be unique per instance; the logo appears more than once on some pages.
	const id = $props.id();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="shrink-0">
	<defs>
		<linearGradient id="{id}-fill" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="oklch(72% 0.17 292.717)" />
			<stop offset="1" stop-color="oklch(48% 0.25 292.717)" />
		</linearGradient>
		<linearGradient id="{id}-sheen" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff" stop-opacity="0.22" />
			<stop offset="0.5" stop-color="#fff" stop-opacity="0" />
		</linearGradient>
	</defs>
	<rect width="32" height="32" rx="9" fill="url(#{id}-fill)" />
	<rect width="32" height="32" rx="9" fill="url(#{id}-sheen)" />
	<!-- A launcher: four app tiles, the first one lit. -->
	<rect x="7" y="7" width="8" height="8" rx="2.2" fill="#fff" />
	<rect x="17" y="7" width="8" height="8" rx="2.2" fill="#fff" fill-opacity="0.72" />
	<rect x="7" y="17" width="8" height="8" rx="2.2" fill="#fff" fill-opacity="0.72" />
	<rect x="17" y="17" width="8" height="8" rx="2.2" fill="#fff" fill-opacity="0.45" />
</svg>
