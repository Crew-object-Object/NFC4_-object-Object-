<script lang="ts">
	import {
		Code,
		EditIcon,
		UserIcon,
		LogInIcon,
		HistoryIcon,
		UserRoundIcon,
		ChevronUpIcon,
		LoaderCircleIcon,
		LayoutDashboardIcon
	} from 'lucide-svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	const SIDEBAR_LINK_GROUPS = [
		{
			label: 'Main',
			items: [
				{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
				{ label: 'Editor', href: '/editor', icon: EditIcon },
				{ label: 'History', href: '/history', icon: HistoryIcon },
				{ label: 'Profile', href: '/profile', icon: UserIcon }
			]
		}
	];

	const sidebar = useSidebar();
	const session = authClient.useSession();
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					onclick={() => sidebar.setOpenMobile(false)}
					class="h-fit w-full justify-start bg-primary/10 text-start"
				>
					<a class="flex w-full items-center gap-2 px-2 py-0 text-xl font-semibold" href="/">
						<Code class="size-7 text-primary" />
						CodeCollab
					</a>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		{#each SIDEBAR_LINK_GROUPS as linkGroup (linkGroup.label)}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{linkGroup.label}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each linkGroup.items as link (link.label)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									onclick={() => sidebar.setOpenMobile(false)}
									isActive={page.url.pathname.startsWith(link.href)}
								>
									{#snippet child({ props })}
										<a
											{...props}
											href={link.href}
											target={link.label === 'Github' ? '_blank' : '_self'}
										>
											<svelte:component this={link.icon} />
											<span>{link.label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu class="flex w-full flex-row">
			<Sidebar.MenuItem class="grow">
				{#if $session.isPending || $session.isRefetching}
					<Sidebar.MenuButton variant="outline" class="justify-center">
						<LoaderCircleIcon class="animate-spin" />
					</Sidebar.MenuButton>
				{:else if !$session.data}
					<Sidebar.MenuButton variant="outline">
						{#snippet child({ props })}
							<a {...props} href="/login">
								<LogInIcon /> Login
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				{:else}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							{#snippet child({ props })}
								<Sidebar.MenuButton variant="outline" {...props}>
									<UserRoundIcon />
									{$session.data!.user.name}
									<ChevronUpIcon class="ml-auto" />
								</Sidebar.MenuButton>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-[var(--bits-dropdown-menu-anchor-width)]">
							<DropdownMenu.Group>
								<DropdownMenu.Item
									class="text-destructive"
									onclick={() => {
										authClient.signOut();
										goto('/');
									}}
								>
									<LogInIcon />
									Logout
								</DropdownMenu.Item>
							</DropdownMenu.Group>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
