<script lang="ts">
	import { onMount } from 'svelte';
	import { useSession } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { Calendar, Clock, User, Plus, Video, ArrowRight } from 'lucide-svelte';

	const session = useSession();

	interface Interview {
		id: string;
		interviewTitle: string;
		interviewDescription: string;
		startTime: string;
		endTime: string;
		status: 'PENDING' | 'COMPLETED';
		roomId: string;
		interviewer: {
			id: string;
			name: string;
			email: string;
		};
		interviewee: {
			id: string;
			name: string;
			email: string;
		};
	}

	let interviews = $state<Interview[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const fetchInterviews = async () => {
		try {
			loading = true;
			const response = await fetch('/api/interviews');
			const result = await response.json();

			if (result.success) {
				const now = new Date();
				interviews = result.data.filter(
					(interview: Interview) =>
						interview.status === 'PENDING' && new Date(interview.startTime) > now
				);
			} else {
				error = result.error || 'Failed to fetch interviews';
			}
		} catch (err) {
			error = 'Failed to fetch interviews';
			console.error('Error fetching interviews:', err);
		} finally {
			loading = false;
		}
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return 'Tomorrow';
		}

		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	};

	const formatTime = (dateString: string) => {
		return new Date(dateString).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getTimeUntilInterview = (dateString: string) => {
		const now = new Date();
		const interviewTime = new Date(dateString);
		const diffMs = interviewTime.getTime() - now.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffHours / 24);

		if (diffDays > 0) {
			return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
		} else if (diffHours > 0) {
			return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
		} else {
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			return `in ${diffMinutes} min${diffMinutes !== 1 ? 's' : ''}`;
		}
	};

	const isInterviewer = (user: any) => {
		return user?.role === 'Interviewer';
	};

	const getUserRole = (interview: Interview, userId: string) => {
		return interview.interviewer.id === userId ? 'interviewer' : 'interviewee';
	};

	const getOtherParticipant = (interview: Interview, userId: string) => {
		return interview.interviewer.id === userId ? interview.interviewee : interview.interviewer;
	};

	const getInitials = (name: string) => {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	};

	onMount(() => {
		fetchInterviews();
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
	<div class="container mx-auto space-y-6 p-4">
		<div class="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
			<div class="space-y-1">
				<h1
					class="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent"
				>
					Dashboard
				</h1>
				<p class="text-sm text-muted-foreground">Your upcoming interviews at a glance</p>
			</div>

			{#if $session.data?.user && isInterviewer($session.data.user)}
				<Button
					href="/create-interview"
					size="sm"
					class="flex items-center gap-2 bg-primary shadow-md hover:bg-primary/90"
				>
					<Plus class="h-3 w-3" />
					Schedule Interview
				</Button>
			{/if}
		</div>

		<div class="grid gap-4">
			{#if loading}
				<Card class="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm">
					<CardHeader class="pb-2">
						<CardTitle class="flex items-center gap-2 text-lg">
							<div class="rounded-md bg-primary/10 p-1.5">
								<Calendar class="h-4 w-4 text-primary" />
							</div>
							Upcoming Interviews
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-3">
						{#each Array(2) as _}
							<div
								class="flex animate-pulse items-center space-x-3 rounded-lg border border-border/50 bg-background/50 p-4 backdrop-blur-sm"
							>
								<div class="h-10 w-10 rounded-full bg-muted"></div>
								<div class="flex-1 space-y-2">
									<div class="h-3 w-48 rounded bg-muted"></div>
									<div class="h-2 w-32 rounded bg-muted"></div>
								</div>
								<div class="h-6 w-16 rounded bg-muted"></div>
							</div>
						{/each}
					</CardContent>
				</Card>
			{:else if error}
				<Card class="border-0 bg-gradient-to-br from-destructive/5 to-destructive/10 shadow-lg">
					<CardContent class="py-8 text-center">
						<div class="mx-auto mb-3 w-fit rounded-full bg-destructive/10 p-2">
							<Calendar class="h-6 w-6 text-destructive" />
						</div>
						<h3 class="mb-2 text-base font-semibold">Unable to load interviews</h3>
						<p class="mb-4 text-sm text-muted-foreground">{error}</p>
						<Button variant="outline" size="sm" onclick={fetchInterviews} class="gap-2">
							<ArrowRight class="h-3 w-3" />
							Try Again
						</Button>
					</CardContent>
				</Card>
			{:else if interviews.length === 0}
				<Card class="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm">
					<CardContent class="py-12 text-center">
						<div class="mx-auto mb-4 w-fit rounded-full bg-muted/50 p-3">
							<Calendar class="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 class="mb-2 text-lg font-semibold">No upcoming interviews</h3>
						<p class="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
							{#if $session.data?.user && isInterviewer($session.data.user)}
								Ready to schedule your next interview? Create one to get started.
							{:else}
								Your scheduled interviews will appear here when available.
							{/if}
						</p>
						{#if $session.data?.user && isInterviewer($session.data.user)}
							<Button
								href="/create-interview"
								size="sm"
								class="gap-2 bg-primary shadow-md hover:bg-primary/90"
							>
								<Plus class="h-3 w-3" />
								Schedule Interview
							</Button>
						{/if}
					</CardContent>
				</Card>
			{:else}
				<Card class="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg backdrop-blur-sm">
					<CardHeader class="pb-2">
						<CardTitle class="flex items-center gap-2 text-lg">
							<div class="rounded-md bg-primary/10 p-1.5">
								<Calendar class="h-4 w-4 text-primary" />
							</div>
							Upcoming Interviews
							<Badge variant="secondary" class="ml-auto text-xs">
								{interviews.length}
							</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-3">
						{#each interviews as interview}
							<Card
								class="group border border-border/50 bg-gradient-to-r from-background to-background/80 transition-all duration-300 hover:shadow-md"
							>
								<CardContent>
									<div class="flex items-start justify-between gap-3">
										<div class="flex flex-1 items-start gap-3">
											<Avatar class="h-10 w-10 border-2 border-primary/20">
												<AvatarImage
													src=""
													alt={getOtherParticipant(interview, $session.data?.user?.id || '').name}
												/>
												<AvatarFallback class="bg-primary/10 text-xs font-semibold text-primary">
													{getInitials(
														getOtherParticipant(interview, $session.data?.user?.id || '').name
													)}
												</AvatarFallback>
											</Avatar>

											<div class="flex-1 space-y-2">
												<div class="flex items-start justify-between">
													<div>
														<h3
															class="text-base font-semibold leading-tight transition-colors group-hover:text-primary"
														>
															{interview.interviewTitle}
														</h3>
														<p class="mt-0.5 text-xs text-muted-foreground">
															{interview.interviewDescription}
														</p>
													</div>
													<Badge
														variant="outline"
														class="shrink-0 border-primary/20 bg-primary/5 text-xs text-primary"
													>
														{getTimeUntilInterview(interview.startTime)}
													</Badge>
												</div>

												<div class="flex flex-wrap items-center gap-3 text-xs">
													<div class="flex items-center gap-1.5 text-muted-foreground">
														<Calendar class="h-3 w-3" />
														<span class="font-medium">{formatDate(interview.startTime)}</span>
													</div>
													<div class="flex items-center gap-1.5 text-muted-foreground">
														<Clock class="h-3 w-3" />
														<span
															>{formatTime(interview.startTime)} - {formatTime(
																interview.endTime
															)}</span
														>
													</div>
													<div class="flex items-center gap-1.5 text-muted-foreground">
														<User class="h-3 w-3" />
														<span>
															{#if $session.data?.user}
																{getUserRole(interview, $session.data.user.id) === 'interviewer'
																	? 'Interviewing'
																	: 'Interview with'}
																<span class="font-medium text-foreground">
																	{getOtherParticipant(interview, $session.data.user.id).name}
																</span>
															{/if}
														</span>
													</div>
												</div>
											</div>
										</div>

										<Button
											href="/editor/{interview.roomId}"
											size="sm"
											class="gap-1.5 bg-primary shadow-sm transition-all group-hover:shadow-md hover:bg-primary/90"
										>
											<Video class="h-3 w-3" />
											Join Interview
										</Button>
									</div>
								</CardContent>
							</Card>
						{/each}
					</CardContent>
				</Card>
			{/if}
		</div>
	</div>
</div>
