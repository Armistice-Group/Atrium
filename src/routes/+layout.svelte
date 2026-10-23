<script lang="ts">
	import '../app.css';
	import ConfirmHost from '#lib/components/ConfirmHost.svelte';
	import Toaster from '#lib/components/Toaster.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/favicon.svg" type="image/svg+xml" /></svelte:head>

{@render children()}
<Toaster />
<ConfirmHost />
