<script lang="ts">
	import { onMount } from 'svelte';
	import { useSession } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import {
		Calendar,
		Clock,
		User,
		Trophy,
		FileText,
		Filter,
		ArrowUpDown,
		History,
		Users,
		UserCheck,
		UserCog,
		Award,
		Target
	} from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';

	const session = useSession();

	interface HistoricalInterview {
		id: string;
		interviewTitle: string;
		interviewDescription: string;
		startTime: string;
		endTime: string;
		status: 'COMPLETED';
		roomId: string;
		interviewScore: number;
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
		problems: {
			id: string;
			title: string;
			score: number;
		}[];
	}

	let interviews = $state<HistoricalInterview[]>([]);
	let filteredInterviews = $state<HistoricalInterview[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let sortBy = $state('recent');
	let filterBy = $state('all');

	const fetchInterviews = async () => {
		try {
			loading = true;
			const response = await fetch('/api/interviews/history');
			const result = await response.json();

			if (result.success) {
				interviews = result.data;
				filteredInterviews = result.data;
			} else {
				error = result.error || 'Failed to fetch interview history';
			}
		} catch (err) {
			error = 'Failed to fetch interview history';
			console.error('Error fetching interview history:', err);
		} finally {
			loading = false;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
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

	const formatDuration = (startTime: string, endTime: string) => {
		const start = new Date(startTime);
		const end = new Date(endTime);
		const diffMs = end.getTime() - start.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const hours = Math.floor(diffMins / 60);
		const minutes = diffMins % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	};

	const isInterviewer = (interview: HistoricalInterview) => {
		return interview.interviewer.id === $session?.data?.user?.id;
	};

	const getOtherParticipant = (interview: HistoricalInterview) => {
		return isInterviewer(interview) ? interview.interviewee : interview.interviewer;
	};

	const getInitials = (name: string) => {
		return name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase();
	};

	const getScoreVariant = (score: number) => {
		if (score >= 80) return 'default';
		if (score >= 60) return 'secondary';
		return 'outline';
	};

	const getScoreColor = (score: number) => {
		if (score >= 80) return 'text-primary border-primary/20 bg-primary/10';
		if (score >= 60) return 'text-muted-foreground border-border bg-muted/50';
		return 'text-muted-foreground border-border bg-muted/30';
	};

	const getTotalProblemsScore = (problems: HistoricalInterview['problems']) => {
		return problems.reduce((total, problem) => total + problem.score, 0);
	};

	$effect(() => {
		let filtered = interviews;

		if (searchQuery) {
			filtered = filtered.filter(
				(interview) =>
					interview.interviewTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
					interview.interviewer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					interview.interviewee.name.toLowerCase().includes(searchQuery.toLowerCase())
			);
		}

		if (filterBy === 'interviewer') {
			filtered = filtered.filter((interview) => isInterviewer(interview));
		} else if (filterBy === 'interviewee') {
			filtered = filtered.filter((interview) => !isInterviewer(interview));
		}

		if (sortBy === 'recent') {
			filtered.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
		} else if (sortBy === 'oldest') {
			filtered.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
		} else if (sortBy === 'score') {
			filtered.sort((a, b) => b.interviewScore - a.interviewScore);
		} else if (sortBy === 'title') {
			filtered.sort((a, b) => a.interviewTitle.localeCompare(b.interviewTitle));
		}

		filteredInterviews = filtered;
	});

	onMount(() => {
		fetchInterviews();
	});
</script>

<div class="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
	<div class="container mx-auto max-w-7xl space-y-8 p-6">
		<div class="flex flex-col gap-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-lg">
						<History class="h-6 w-6 text-primary" />
					</div>
					<div>
						<h1 class="text-3xl font-bold tracking-tight">Interview History</h1>
						<p class="text-sm text-muted-foreground">
							Track your completed interviews and performance
						</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<div class="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2 border border-primary/20">
						<div class="flex items-center gap-2">
							<Calendar class="h-4 w-4 text-primary" />
							<div class="text-right">
								<div class="text-2xl font-bold text-foreground">{interviews.length}</div>
								<div class="text-xs font-medium text-muted-foreground">Total Interviews</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<Card class="border-border/50 bg-card/50 p-4 shadow-lg backdrop-blur-sm">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div class="relative flex-1 max-w-md">
						<Input
							type="text"
							placeholder="Search interviews..."
							class="h-10 border-border/50 bg-background/50 text-sm transition-colors focus:bg-background focus:border-primary/50"
							bind:value={searchQuery}
						/>
					</div>

					<div class="flex items-center space-x-3">
						<Select.Root
							type="single"
							value={filterBy}
							onValueChange={(value) => value && (filterBy = value)}
						>
							<Select.Trigger class="h-10 w-36 border-border/50 bg-background/50 text-sm transition-colors hover:bg-background focus:border-primary/50">
								<Filter class="mr-2 h-4 w-4 text-primary" />
								<span class="font-medium">
									{filterBy === 'all'
										? 'All'
										: filterBy === 'interviewer'
											? 'Conducted'
											: 'Attended'}
								</span>
							</Select.Trigger>
							<Select.Content class="w-36">
								<Select.Item value="all" class="text-sm">All Interviews</Select.Item>
								<Select.Item value="interviewer" class="text-sm">Conducted</Select.Item>
								<Select.Item value="interviewee" class="text-sm">Attended</Select.Item>
							</Select.Content>
						</Select.Root>

						<Select.Root
							type="single"
							value={sortBy}
							onValueChange={(value) => value && (sortBy = value)}
						>
							<Select.Trigger class="h-10 w-32 border-border/50 bg-background/50 text-sm transition-colors hover:bg-background focus:border-primary/50">
								<ArrowUpDown class="mr-2 h-4 w-4 text-primary" />
								<span class="font-medium">
									{sortBy === 'recent' ? 'Recent' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'score' ? 'Score' : 'Title'}
								</span>
							</Select.Trigger>
							<Select.Content class="w-32">
								<Select.Item value="recent" class="text-sm">Recent</Select.Item>
								<Select.Item value="oldest" class="text-sm">Oldest</Select.Item>
								<Select.Item value="score" class="text-sm">Score</Select.Item>
								<Select.Item value="title" class="text-sm">Title</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
				</div>
			</Card>
		</div>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<Card class="border-border/60 bg-gradient-to-r from-card via-card/50 to-card/95">
						<CardContent class="px-8 py-5">
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-4 flex-1 min-w-0">
									<div class="flex items-center space-x-4">
										<div class="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 animate-pulse shadow-sm">
											<div class="h-5 w-5 bg-muted/60 rounded"></div>
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-3 mb-1">
												<div class="h-5 bg-muted rounded animate-pulse w-48"></div>
												<div class="h-6 w-20 bg-muted/50 rounded animate-pulse"></div>
											</div>
											<div class="h-3 bg-muted/50 rounded animate-pulse w-32"></div>
										</div>
									</div>
								</div>
								<div class="hidden lg:flex items-center space-x-8 px-6">
									<div class="flex items-center space-x-2">
										<div class="rounded-full bg-primary/10 p-1.5 animate-pulse">
											<div class="h-3.5 w-3.5 bg-muted/60 rounded"></div>
										</div>
										<div class="h-3 bg-muted rounded animate-pulse w-20"></div>
									</div>
									<div class="flex items-center space-x-2">
										<div class="rounded-full bg-primary/10 p-1.5 animate-pulse">
											<div class="h-3.5 w-3.5 bg-muted/60 rounded"></div>
										</div>
										<div class="h-3 bg-muted rounded animate-pulse w-16"></div>
									</div>
									<div class="flex items-center space-x-2">
										<div class="rounded-full bg-primary/10 p-1.5 animate-pulse">
											<div class="h-3.5 w-3.5 bg-muted/60 rounded"></div>
										</div>
										<div class="h-3 bg-muted rounded animate-pulse w-24"></div>
									</div>
								</div>
								<div class="flex items-center space-x-4">
									<div class="hidden lg:flex items-center space-x-3">
										<div class="h-10 w-10 bg-muted rounded-full animate-pulse border-2 border-primary/20 shadow-md"></div>
										<div class="min-w-0">
											<div class="h-3 bg-muted rounded animate-pulse w-20 mb-1"></div>
											<div class="h-2 bg-muted/50 rounded animate-pulse w-16"></div>
										</div>
									</div>
									<div class="h-8 w-16 bg-muted rounded animate-pulse shadow-md"></div>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{:else if error}
			<Card class="border-destructive/50 bg-destructive/5 shadow-sm">
				<CardContent class="pt-6 pb-6">
					<div class="flex items-center space-x-3 text-destructive">
						<div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-destructive">
							<span class="text-xs font-bold">!</span>
						</div>
						<div>
							<p class="font-semibold">Error Loading Interviews</p>
							<p class="text-sm">{error}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		{:else if filteredInterviews.length === 0}
			<Card class="border-2 border-dashed shadow-sm">
				<CardContent class="pt-8 pb-8">
					<div class="space-y-4 text-center">
						<div class="mx-auto w-fit rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-4">
							<Calendar class="h-8 w-8 text-primary" />
						</div>
						<div>
							<h3 class="font-semibold">No interviews found</h3>
							<p class="text-sm text-muted-foreground">
								{searchQuery || filterBy !== 'all'
									? 'Try adjusting your search or filters'
									: "You haven't completed any interviews yet"}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each filteredInterviews as interview (interview.id)}
					<Card class="group border-border/60 bg-gradient-to-r from-card via-card/50 to-card/95 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 backdrop-blur-sm">
						<CardContent class="px-8 py-5">
							<div class="flex items-center justify-between">
								<!-- Left: Interview Info -->
								<div class="flex items-center space-x-4 flex-1 min-w-0">
									<div class="flex items-center space-x-4">
										{#if isInterviewer(interview)}
											<div class="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-sm">
												<UserCog class="h-5 w-5 text-primary" />
											</div>
										{:else}
											<div class="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-sm">
												<UserCheck class="h-5 w-5 text-primary" />
											</div>
										{/if}
										
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-3 mb-1">
												<h3 class="font-bold text-lg leading-tight group-hover:text-primary transition-colors truncate">
													{interview.interviewTitle}
												</h3>
												<Badge 
													variant={isInterviewer(interview) ? 'default' : 'secondary'} 
													class="px-3 py-1 text-xs font-semibold shrink-0 shadow-sm"
												>
													{isInterviewer(interview) ? 'Conducted' : 'Attended'}
												</Badge>
											</div>
											<p class="text-sm text-muted-foreground truncate max-w-md">
												{interview.interviewDescription}
											</p>
										</div>
									</div>
								</div>

								<!-- Center: Interview Details -->
								<div class="hidden lg:flex items-center space-x-8 px-6">
									<div class="flex items-center space-x-2 text-sm">
										<div class="rounded-full bg-primary/10 p-1.5">
											<Calendar class="h-3.5 w-3.5 text-primary" />
										</div>
										<span class="font-semibold text-foreground">{formatDate(interview.startTime)}</span>
									</div>
									<div class="flex items-center space-x-2 text-sm">
										<div class="rounded-full bg-primary/10 p-1.5">
											<Clock class="h-3.5 w-3.5 text-primary" />
										</div>
										<span class="font-semibold text-foreground">{formatDuration(interview.startTime, interview.endTime)}</span>
									</div>
									{#if interview.problems.length > 0}
										<div class="flex items-center space-x-2 text-sm">
											<div class="rounded-full bg-primary/10 p-1.5">
												<Target class="h-3.5 w-3.5 text-primary" />
											</div>
											<span class="font-semibold text-foreground">{interview.problems.length} problems</span>
										</div>
									{/if}
								</div>

								<!-- Right: Participant & Score -->
								<div class="flex items-center space-x-4">
									<div class="hidden lg:flex items-center space-x-3">
										<Avatar class="h-10 w-10 border-2 border-primary/20 shadow-md">
											<AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getOtherParticipant(interview).name}`} alt={getOtherParticipant(interview).name} />
											<AvatarFallback class="bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary">
												{getInitials(getOtherParticipant(interview).name)}
											</AvatarFallback>
										</Avatar>
										<div class="min-w-0">
											<p class="text-sm font-semibold truncate max-w-32 text-foreground">{getOtherParticipant(interview).name}</p>
											<p class="text-xs text-muted-foreground truncate max-w-32">{getOtherParticipant(interview).email}</p>
										</div>
									</div>
									
									<div class="flex items-center">
										<Badge 
											variant={getScoreVariant(interview.interviewScore)}
											class={`px-4 py-2 text-base font-bold shadow-md ${getScoreColor(interview.interviewScore)}`}
										>
											{interview.interviewScore}%
										</Badge>
									</div>
								</div>
							</div>
							
							<!-- Mobile Details -->
							<div class="lg:hidden mt-4 pt-4 border-t border-border/50">
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center space-x-4 text-muted-foreground">
										<div class="flex items-center space-x-1.5">
											<Calendar class="h-3 w-3" />
											<span class="font-medium">{formatDate(interview.startTime)}</span>
										</div>
										<div class="flex items-center space-x-1.5">
											<Clock class="h-3 w-3" />
											<span class="font-medium">{formatDuration(interview.startTime, interview.endTime)}</span>
										</div>
										{#if interview.problems.length > 0}
											<div class="flex items-center space-x-1.5">
												<Target class="h-3 w-3" />
												<span class="font-medium">{interview.problems.length} problems</span>
											</div>
										{/if}
									</div>
									<div class="flex items-center space-x-2">
										<Avatar class="h-6 w-6 border border-primary/20">
											<AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getOtherParticipant(interview).name}`} alt={getOtherParticipant(interview).name} />
											<AvatarFallback class="bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-semibold text-primary">
												{getInitials(getOtherParticipant(interview).name)}
											</AvatarFallback>
										</Avatar>
										<span class="font-semibold text-foreground text-sm">{getOtherParticipant(interview).name}</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{/if}
	</div>
</div>
