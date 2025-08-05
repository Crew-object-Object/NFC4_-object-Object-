<script lang="ts">
	import {
		Card,
		CardTitle,
		CardHeader,
		CardContent,
		CardDescription
	} from '$lib/components/ui/card';
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { User, Mail, Calendar } from 'lucide-svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Separator } from '$lib/components/ui/separator';

	const session = authClient.useSession();

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if $session.isPending}
		<div class="space-y-6">
			<Skeleton class="h-8 w-48" />
			<Card>
				<CardHeader>
					<div class="flex items-center space-x-4">
						<Skeleton class="h-20 w-20 rounded-full" />
						<div class="space-y-2">
							<Skeleton class="h-6 w-32" />
							<Skeleton class="h-4 w-48" />
						</div>
					</div>
				</CardHeader>
				<CardContent class="space-y-4">
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-3/4" />
					<Skeleton class="h-4 w-1/2" />
				</CardContent>
			</Card>
		</div>
	{:else if $session.data?.user}
		<div class="space-y-6">
			<div class="grid gap-6 md:grid-cols-1">
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<User class="h-5 w-5" />
							Account Information
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">User ID</span>
							<span class="font-mono text-sm">{$session.data.user.id}</span>
						</div>
						<Separator />
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Email</span>
							<div class="flex items-center gap-2">
								<Mail class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm">{$session.data.user.email}</span>
							</div>
						</div>
						<Separator />
						<div class="flex items-center justify-between">
							<span class="text-sm text-muted-foreground">Member Since</span>
							<div class="flex items-center gap-2">
								<Calendar class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm">{formatDate($session.data.user.createdAt)}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	{:else}
		<div class="flex min-h-[60vh] items-center justify-center">
			<Card class="w-full max-w-md">
				<CardHeader class="text-center">
					<CardTitle>Access Denied</CardTitle>
					<CardDescription>You need to be signed in to view this page</CardDescription>
				</CardHeader>
				<CardContent>
					<Button class="w-full" onclick={() => (window.location.href = '/')}>Go to Home</Button>
				</CardContent>
			</Card>
		</div>
	{/if}
</div>
