<script lang="ts">
	import { page } from '$app/state';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';

	type Item = { label: string; href?: string };

	function pathnameToItems(pathname: string): Item[] {
		const parts = pathname.split('/').filter((part) => part !== '');
		const items = [
			...parts.map((part, index) => {
				if (index === parts.length - 1) {
					part = part.split('?')[0];
				}
				return {
					label: part
						.split('-')
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' '),
					href: `/${parts.slice(0, index + 1).join('/')}`
				};
			})
		];
		return items;
	}

	let items = $derived(pathnameToItems(page.url.pathname));
</script>

<Breadcrumb.Root>
	<Breadcrumb.List>
		{#each items as item, idx (item.label)}
			<Breadcrumb.Item>
				{#if idx !== items.length - 1}
					<Breadcrumb.Link href={item.href}>
						{item.label}
					</Breadcrumb.Link>
				{:else}
					<span class="font-semibold text-foreground">{item.label}</span>
				{/if}
			</Breadcrumb.Item>
			{#if idx !== items.length - 1}
				<Breadcrumb.Separator />
			{/if}
		{/each}
	</Breadcrumb.List>
</Breadcrumb.Root>
