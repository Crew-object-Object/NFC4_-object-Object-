<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app-sidebar.svelte';

	let { children } = $props();
</script>

<div class="min-h-screen min-w-full overflow-hidden overflow-y-auto">
	<Sidebar.Provider
		style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
	>
		<AppSidebar variant="inset" />
		<Sidebar.Inset>
			<main class="mx-auto flex w-full flex-col gap-4 p-4">
				<div class="flex h-6 items-center gap-2">
					<Sidebar.Trigger />
				</div>
				{@render children?.()}
			</main>
		</Sidebar.Inset>
	</Sidebar.Provider>
</div>
