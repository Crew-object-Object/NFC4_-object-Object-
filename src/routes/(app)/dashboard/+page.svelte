<script lang="ts">
	import { onMount } from 'svelte';
	import { useSession } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Calendar, Clock, User, Plus } from 'lucide-svelte';

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

	let interviews: Interview[] = [];
	let loading = true;
	let error: string | null = null;

	const fetchInterviews = async () => {
		try {
			loading = true;
			const response = await fetch('/api/interviews');
			const result = await response.json();

			if (result.success) {
				interviews = result.data;
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
		return new Date(dateString).toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
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

	const isInterviewer = (user: any) => {
		return user?.role === 'Interviewer';
	};

	const getUserRole = (interview: Interview, userId: string) => {
		return interview.interviewer.id === userId ? 'interviewer' : 'interviewee';
	};

	const getOtherParticipant = (interview: Interview, userId: string) => {
		return interview.interviewer.id === userId ? interview.interviewee : interview.interviewer;
	};

	onMount(() => {
		fetchInterviews();
	});
</script>

<div class="container mx-auto p-6 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Dashboard</h1>
			<p class="text-muted-foreground">
				Welcome back! Here's an overview of your upcoming interviews.
			</p>
		</div>
		
		{#if $session.data?.user && isInterviewer($session.data.user)}
			<Button href="/create-interview" class="flex items-center gap-2">
				<Plus class="h-4 w-4" />
				Create Interview
			</Button>
		{/if}
	</div>

	<div class="grid gap-6">
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Calendar class="h-5 w-5" />
					Upcoming Interviews
				</CardTitle>
				<CardDescription>
					Your scheduled interviews for the coming days
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if loading}
					<div class="space-y-4">
						{#each Array(3) as _}
							<div class="flex items-center space-x-4 p-4 border rounded-lg">
								<Skeleton class="h-12 w-12 rounded-full" />
								<div class="space-y-2 flex-1">
									<Skeleton class="h-4 w-[250px]" />
									<Skeleton class="h-4 w-[200px]" />
								</div>
								<Skeleton class="h-8 w-20" />
							</div>
						{/each}
					</div>
				{:else if error}
					<div class="text-center py-8">
						<p class="text-destructive mb-4">{error}</p>
						<Button variant="outline" onclick={fetchInterviews}>
							Try Again
						</Button>
					</div>
				{:else if interviews.length === 0}
					<div class="text-center py-8">
						<Calendar class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 class="text-lg font-semibold mb-2">No upcoming interviews</h3>
						<p class="text-muted-foreground mb-4">
							{#if $session.data?.user && isInterviewer($session.data.user)}
								Create your first interview to get started.
							{:else}
								Your upcoming interviews will appear here.
							{/if}
						</p>
						{#if $session.data?.user && isInterviewer($session.data.user)}
							<Button href="/create-interview" variant="outline">
								<Plus class="h-4 w-4 mr-2" />
								Create Interview
							</Button>
						{/if}
					</div>
				{:else}
					<div class="space-y-4">
						{#each interviews as interview}
							<Card class="border-l-4 border-l-primary">
								<CardContent class="p-4">
									<div class="flex items-start justify-between">
										<div class="space-y-2 flex-1">
											<div class="flex items-center gap-3">
												<h3 class="font-semibold text-lg">{interview.interviewTitle}</h3>
												<Badge variant={interview.status === 'PENDING' ? 'default' : 'secondary'}>
													{interview.status}
												</Badge>
											</div>
											
											<p class="text-muted-foreground text-sm">
												{interview.interviewDescription}
											</p>
											
											<div class="flex items-center gap-4 text-sm text-muted-foreground">
												<div class="flex items-center gap-1">
													<Calendar class="h-4 w-4" />
													{formatDate(interview.startTime)}
												</div>
												<div class="flex items-center gap-1">
													<Clock class="h-4 w-4" />
													{formatTime(interview.startTime)} - {formatTime(interview.endTime)}
												</div>
												<div class="flex items-center gap-1">
													<User class="h-4 w-4" />
													{#if $session.data?.user}
														{getUserRole(interview, $session.data.user.id) === 'interviewer' ? 'Interviewing' : 'Interview with'}
														{getOtherParticipant(interview, $session.data.user.id).name}
													{/if}
												</div>
											</div>
										</div>
										
										<div class="flex flex-col gap-2">
											{#if interview.status === 'PENDING'}
												<Button 
													href="/editor/{interview.roomId}" 
													size="sm"
													class="w-full"
												>
													Join Interview
												</Button>
											{/if}
										</div>
									</div>
								</CardContent>
							</Card>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>

