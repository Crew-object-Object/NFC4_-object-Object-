<script lang="ts">
	import { toTitleCase } from '$lib/utils';
	import { signOut } from '$lib/hooks/auth';
	import { useAuth } from '$lib/hooks/use-auth';
	import { toggleMode, mode } from 'mode-watcher';
	import { Switch } from '$lib/components/ui/switch';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { ChevronsUpDown, LogOut, Loader2, Moon } from 'lucide-svelte';

	const auth = useAuth();
	const sidebar = useSidebar();
	let isSigningOut = $state(false);
	const { user, isLoading } = $derived($auth);
	let isDarkMode = $state(mode.current === 'dark');
	const displayName = $derived(user?.name ? toTitleCase(user.name) : 'User');

	$effect(() => {
		isDarkMode = mode.current === 'dark';
	});

	async function handleSignOut() {
		if (isSigningOut) return;
		isSigningOut = true;

		try {
			await signOut();
		} catch (error) {
			console.error('Error signing out:', error);
		} finally {
			isSigningOut = false;
		}
	}
</script>

{#if isLoading}
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<Sidebar.MenuButton size="lg" aria-disabled={true}>
				<div class="h-8 w-8 animate-pulse rounded-lg bg-muted"></div>
				<div class="flex-1 space-y-2">
					<div class="h-3 w-24 animate-pulse rounded bg-muted"></div>
					<div class="h-2 w-32 animate-pulse rounded bg-muted"></div>
				</div>
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
{:else if user}
	<Sidebar.Menu>
		<Sidebar.MenuItem>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton
							size="lg"
							{...props}
							class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar.Root class="h-8 w-8 rounded-lg">
								{#if user.image}
									<Avatar.Image src={user.image} alt={user.name ?? user.email} />
								{:else}
									<Avatar.Fallback class="rounded-lg">
										{user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
									</Avatar.Fallback>
								{/if}
							</Avatar.Root>

							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">{displayName}</span>
								<span class="truncate text-xs">{user.email}</span>
							</div>

							<ChevronsUpDown class="ml-auto size-4" />
						</Sidebar.MenuButton>
					{/snippet}
				</DropdownMenu.Trigger>

				<DropdownMenu.Content
					align="end"
					sideOffset={4}
					side={sidebar.isMobile ? 'bottom' : 'right'}
					class="w-[var(--bits-dropdown-menu-anchor-width)] min-w-56 rounded-lg"
				>
					<DropdownMenu.Label class="p-0 font-normal">
						<div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
							<Avatar.Root class="h-8 w-8 rounded-lg">
								{#if user.image}
									<Avatar.Image src={user.image} alt={user.name ?? user.email} />
								{:else}
									<Avatar.Fallback class="rounded-lg">
										{user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
									</Avatar.Fallback>
								{/if}
							</Avatar.Root>

							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-semibold">{displayName}</span>
								<span class="truncate text-xs">{user.email}</span>
							</div>
						</div>
					</DropdownMenu.Label>

					<DropdownMenu.Separator />

					<DropdownMenu.Item
						onclick={(e) => e.preventDefault()}
						class="flex cursor-pointer items-center"
					>
						<div class="flex flex-1 items-center gap-2">
							<Moon class="mr-2 h-4 w-4" />
							<span>Dark mode</span>
						</div>
						<Switch checked={isDarkMode} onclick={toggleMode} />
					</DropdownMenu.Item>

					<DropdownMenu.Separator />

					<DropdownMenu.Item class="cursor-pointer" onclick={handleSignOut} disabled={isSigningOut}>
						{#if isSigningOut}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							<span>Signing out...</span>
						{:else}
							<LogOut class="mr-2 h-4 w-4" />
							<span>Log out</span>
						{/if}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</Sidebar.MenuItem>
	</Sidebar.Menu>
{/if}
