<script lang="ts">
	import '../app.css';
	let { children } = $props();
	import { Toaster } from 'svelte-sonner';
	import { ModeWatcher } from 'mode-watcher';
</script>

<Toaster />
<ModeWatcher />
{@render children?.()}
