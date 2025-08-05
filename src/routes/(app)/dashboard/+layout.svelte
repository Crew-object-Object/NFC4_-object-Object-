<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { Separator } from '$lib/components/ui/separator';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import Breadcrumbs from '$lib/components/breadcrumbs.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />

	<div class="flex h-screen w-full flex-col">
		<header class="flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
			<Sidebar.Trigger />
			<Separator orientation="vertical" class="mr-2 h-6" />
			<Breadcrumbs />
		</header>

		<ScrollArea class="h-[calc(100vh-3rem)]">
			<main class="flex w-full flex-col gap-4">
				{@render children?.()}
			</main>
		</ScrollArea>
	</div>
</Sidebar.Provider>
