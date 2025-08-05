<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { ChevronUpIcon, LoaderCircleIcon, LogInIcon, UserRoundIcon } from 'lucide-svelte';
	import HomeIcon from 'lucide-svelte/icons/home';
	import EditIcon from 'lucide-svelte/icons/edit';
	import UserIcon from 'lucide-svelte/icons/user';
	import SettingsIcon from 'lucide-svelte/icons/settings';
	import UserCheckIcon from 'lucide-svelte/icons/user-check';
	import GithubIcon from 'lucide-svelte/icons/github';

	const SIDEBAR_LINK_GROUPS = [
		{
			label: 'Main',
			items: [
				{ label: 'Home', href: '/', icon: HomeIcon },
				{ label: 'Editor', href: '/editor', icon: EditIcon },
				{ label: 'Profile', href: '/profile', icon: UserIcon }
			]
		},
		{
			label: 'Settings',
			items: [
				{
					label: 'Preferences',
					href: '/settings/preferences',
					icon: SettingsIcon
				},
				{
					label: 'Account',
					href: '/settings/account',
					icon: UserCheckIcon
				}
			]
		},
		{
			label: 'External',
			items: [
				{
					label: 'Github',
					href: 'https://github.com',
					icon: GithubIcon
				}
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
					class="h-fit w-full justify-start bg-secondary text-start"
					onclick={() => sidebar.setOpenMobile(false)}
				>
					<a class="flex w-full items-center gap-2 px-2 py-0 text-xl font-semibold" href="/">
						<img src="/favicon.ico" alt="logo" class="h-12 w-12" />
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
											href={link.href}
											target={link.label === 'Github' ? '_blank' : '_self'}
											{...props}
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
								<DropdownMenu.Item onclick={() => sidebar.setOpenMobile(false)}>
									{#snippet child({ props })}
										<a href="/profile" {...props}><UserRoundIcon /> Profile</a>
									{/snippet}
								</DropdownMenu.Item>
								<DropdownMenu.Item
									class="text-destructive"
									onclick={() => {
										authClient.signOut();
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
