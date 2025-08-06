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
		Target,
		ChevronDown,
		ChevronRight,
		Code,
		CheckCircle,
		XCircle,
		PlayCircle
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
			description: string;
			score: number;
			testCases: {
				testCaseId: string;
				input: string;
				output: string;
			}[];
		}[];
	}

	let interviews = $state<HistoricalInterview[]>([]);
	let filteredInterviews = $state<HistoricalInterview[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let sortBy = $state('recent');
	let filterBy = $state('all');
	let expandedInterviews = $state<Set<string>>(new Set());

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

	const getAverageProblemsScore = (problems: HistoricalInterview['problems']) => {
		if (problems.length === 0) return 0;
		return Math.round(getTotalProblemsScore(problems) / problems.length);
	};

	const getPassedTestCases = (problem: HistoricalInterview['problems'][0]) => {
		if (problem.testCases.length === 0) return 0;
		return Math.round((problem.score / 100) * problem.testCases.length);
	};

	const toggleInterviewExpansion = (interviewId: string) => {
		if (expandedInterviews.has(interviewId)) {
			expandedInterviews.delete(interviewId);
		} else {
			expandedInterviews.add(interviewId);
		}
		expandedInterviews = new Set(expandedInterviews);
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
					<div
						class="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-2"
					>
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
					<div class="relative max-w-md flex-1">
						<Input
							type="text"
							placeholder="Search interviews..."
							class="h-10 border-border/50 bg-background/50 text-sm transition-colors focus:border-primary/50 focus:bg-background"
							bind:value={searchQuery}
						/>
					</div>

					<div class="flex items-center space-x-3">
						<Select.Root
							type="single"
							value={filterBy}
							onValueChange={(value) => value && (filterBy = value)}
						>
							<Select.Trigger
								class="h-10 w-36 border-border/50 bg-background/50 text-sm transition-colors hover:bg-background focus:border-primary/50"
							>
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
							<Select.Trigger
								class="h-10 w-32 border-border/50 bg-background/50 text-sm transition-colors hover:bg-background focus:border-primary/50"
							>
								<ArrowUpDown class="mr-2 h-4 w-4 text-primary" />
								<span class="font-medium">
									{sortBy === 'recent'
										? 'Recent'
										: sortBy === 'oldest'
											? 'Oldest'
											: sortBy === 'score'
												? 'Score'
												: 'Title'}
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
						<CardContent class="px-8">
							<div class="flex items-center justify-between">
								<div class="flex min-w-0 flex-1 items-center space-x-4">
									<div class="flex items-center space-x-4">
										<div
											class="animate-pulse rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-sm"
										>
											<div class="h-5 w-5 rounded bg-muted/60"></div>
										</div>
										<div class="min-w-0 flex-1">
											<div class="mb-1 flex items-center gap-3">
												<div class="h-5 w-48 animate-pulse rounded bg-muted"></div>
												<div class="h-6 w-20 animate-pulse rounded bg-muted/50"></div>
											</div>
											<div class="h-3 w-32 animate-pulse rounded bg-muted/50"></div>
										</div>
									</div>
								</div>
								<div class="hidden items-center space-x-8 px-6 lg:flex">
									<div class="flex items-center space-x-2">
										<div class="animate-pulse rounded-full bg-primary/10 p-1.5">
											<div class="h-3.5 w-3.5 rounded bg-muted/60"></div>
										</div>
										<div class="h-3 w-20 animate-pulse rounded bg-muted"></div>
									</div>
									<div class="flex items-center space-x-2">
										<div class="animate-pulse rounded-full bg-primary/10 p-1.5">
											<div class="h-3.5 w-3.5 rounded bg-muted/60"></div>
										</div>
										<div class="h-3 w-16 animate-pulse rounded bg-muted"></div>
									</div>
									<div class="flex items-center space-x-2">
										<div class="animate-pulse rounded-full bg-primary/10 p-1.5">
											<div class="h-3.5 w-3.5 rounded bg-muted/60"></div>
										</div>
										<div class="h-3 w-24 animate-pulse rounded bg-muted"></div>
									</div>
								</div>
								<div class="flex items-center space-x-4">
									<div class="hidden items-center space-x-3 lg:flex">
										<div
											class="h-10 w-10 animate-pulse rounded-full border-2 border-primary/20 bg-muted shadow-md"
										></div>
										<div class="min-w-0">
											<div class="mb-1 h-3 w-20 animate-pulse rounded bg-muted"></div>
											<div class="h-2 w-16 animate-pulse rounded bg-muted/50"></div>
										</div>
									</div>
									<div class="h-8 w-16 animate-pulse rounded bg-muted shadow-md"></div>
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
						<div
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-destructive"
						>
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
						<div
							class="mx-auto w-fit rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-4"
						>
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
					<Card
						class="group border-border/60 bg-gradient-to-r from-card via-card/50 to-card/95 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
					>
						<CardContent class="px-8">
							<div class="flex items-center justify-between">
								<!-- Left: Interview Info -->
								<div class="flex min-w-0 flex-1 items-center space-x-4">
									<div class="flex items-center space-x-4">
										{#if isInterviewer(interview)}
											<div
												class="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-sm"
											>
												<UserCog class="h-5 w-5 text-primary" />
											</div>
										{:else}
											<div
												class="rounded-full bg-gradient-to-br from-primary/20 to-primary/10 p-2.5 shadow-sm"
											>
												<UserCheck class="h-5 w-5 text-primary" />
											</div>
										{/if}

										<div class="min-w-0 flex-1">
											<div class="mb-1 flex items-center gap-3">
												<h3
													class="truncate text-lg leading-tight font-bold transition-colors group-hover:text-primary"
												>
													{interview.interviewTitle}
												</h3>
												<Badge
													variant={isInterviewer(interview) ? 'default' : 'secondary'}
													class="shrink-0 px-3 py-1 text-xs font-semibold shadow-sm"
												>
													{isInterviewer(interview) ? 'Conducted' : 'Attended'}
												</Badge>
											</div>
											<p class="max-w-md truncate text-sm text-muted-foreground">
												{interview.interviewDescription}
											</p>
										</div>
									</div>
								</div>

								<!-- Center: Interview Details -->
								<div class="hidden items-center space-x-8 px-6 lg:flex">
									<div class="flex items-center space-x-2 text-sm">
										<div class="rounded-full bg-primary/10 p-1.5">
											<Calendar class="h-3.5 w-3.5 text-primary" />
										</div>
										<span class="font-semibold text-foreground"
											>{formatDate(interview.startTime)}</span
										>
									</div>
									<div class="flex items-center space-x-2 text-sm">
										<div class="rounded-full bg-primary/10 p-1.5">
											<Clock class="h-3.5 w-3.5 text-primary" />
										</div>
										<span class="font-semibold text-foreground"
											>{formatDuration(interview.startTime, interview.endTime)}</span
										>
									</div>
									{#if interview.problems.length > 0}
										<div class="flex items-center space-x-2 text-sm">
											<div class="rounded-full bg-primary/10 p-1.5">
												<Target class="h-3.5 w-3.5 text-primary" />
											</div>
											<span class="font-semibold text-foreground"
												>{interview.problems.length} problems</span
											>
										</div>
									{/if}
								</div>

								<!-- Right: Participant, Score & Expand Button -->
								<div class="flex items-center space-x-4">
									<div class="hidden items-center space-x-3 lg:flex">
										<Avatar class="h-10 w-10 border-2 border-primary/20 shadow-md">
											<AvatarImage
												src={`https://api.dicebear.com/7.x/initials/svg?seed=${getOtherParticipant(interview).name}`}
												alt={getOtherParticipant(interview).name}
											/>
											<AvatarFallback
												class="bg-gradient-to-br from-primary/15 to-primary/5 text-sm font-bold text-primary"
											>
												{getInitials(getOtherParticipant(interview).name)}
											</AvatarFallback>
										</Avatar>
										<div class="min-w-0">
											<p class="max-w-32 truncate text-sm font-semibold text-foreground">
												{getOtherParticipant(interview).name}
											</p>
											<p class="max-w-32 truncate text-xs text-muted-foreground">
												{getOtherParticipant(interview).email}
											</p>
										</div>
									</div>

									<div class="flex items-center space-x-2">
										<Badge
											variant={getScoreVariant(interview.interviewScore)}
											class={`px-4 py-2 text-base font-bold shadow-md ${getScoreColor(interview.interviewScore)}`}
										>
											{interview.interviewScore}%
										</Badge>
										
										{#if interview.problems.length > 0}
											<Button
												variant="ghost"
												size="sm"
												class="h-8 w-8 p-0 hover:bg-primary/10"
												onclick={() => toggleInterviewExpansion(interview.id)}
											>
												{#if expandedInterviews.has(interview.id)}
													<ChevronDown class="h-4 w-4 text-primary" />
												{:else}
													<ChevronRight class="h-4 w-4 text-primary" />
												{/if}
											</Button>
										{/if}
									</div>
								</div>
							</div>

							<!-- Mobile Details -->
							<div class="mt-4 border-t border-border/50 pt-4 lg:hidden">
								<div class="flex items-center justify-between text-xs">
									<div class="flex items-center space-x-4 text-muted-foreground">
										<div class="flex items-center space-x-1.5">
											<Calendar class="h-3 w-3" />
											<span class="font-medium">{formatDate(interview.startTime)}</span>
										</div>
										<div class="flex items-center space-x-1.5">
											<Clock class="h-3 w-3" />
											<span class="font-medium"
												>{formatDuration(interview.startTime, interview.endTime)}</span
											>
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
											<AvatarImage
												src={`https://api.dicebear.com/7.x/initials/svg?seed=${getOtherParticipant(interview).name}`}
												alt={getOtherParticipant(interview).name}
											/>
											<AvatarFallback
												class="bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-semibold text-primary"
											>
												{getInitials(getOtherParticipant(interview).name)}
											</AvatarFallback>
										</Avatar>
										<span class="text-sm font-semibold text-foreground"
											>{getOtherParticipant(interview).name}</span
										>
									</div>
								</div>
							</div>

							<!-- Expanded Problems Section -->
							{#if expandedInterviews.has(interview.id) && interview.problems.length > 0}
								<div class="mt-6 border-t border-border/50 pt-6">
									<div class="mb-4 flex items-center justify-between">
										<h4 class="flex items-center gap-2 text-lg font-semibold text-foreground">
											<Code class="h-5 w-5 text-primary" />
											Problems Solved
										</h4>
										<div class="flex items-center space-x-4 text-sm">
											<div class="flex items-center space-x-2">
												<span class="font-medium text-muted-foreground">Average Score:</span>
												<Badge
													variant={getScoreVariant(getAverageProblemsScore(interview.problems))}
													class="px-2 py-1 text-sm font-bold"
												>
													{getAverageProblemsScore(interview.problems)}%
												</Badge>
											</div>
										</div>
									</div>

									<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
										{#each interview.problems as problem (problem.id)}
											<Card class="border-border/30 bg-card/50 backdrop-blur-sm">
												<CardHeader class="pb-3">
													<div class="flex items-start justify-between">
														<div class="min-w-0 flex-1">
															<CardTitle class="truncate text-base font-semibold text-foreground">
																{problem.title}
															</CardTitle>
															{#if problem.description}
																<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
																	{problem.description}
																</p>
															{/if}
														</div>
														<Badge
															variant={getScoreVariant(problem.score)}
															class="ml-2 shrink-0 px-2 py-1 text-sm font-bold"
														>
															{problem.score}%
														</Badge>
													</div>
												</CardHeader>
												<CardContent class="pt-0">
													<div class="space-y-3">
														<!-- Test Cases Summary -->
														{#if problem.testCases.length > 0}
															<div class="flex items-center justify-between text-sm">
																<span class="font-medium text-muted-foreground">Test Cases</span>
																<div class="flex items-center space-x-2">
																	<div class="flex items-center space-x-1">
																		<CheckCircle class="h-4 w-4 text-green-500" />
																		<span class="font-semibold text-green-600">
																			{getPassedTestCases(problem)}
																		</span>
																	</div>
																	<span class="text-muted-foreground">/</span>
																	<div class="flex items-center space-x-1">
																		<PlayCircle class="h-4 w-4 text-primary" />
																		<span class="font-semibold text-foreground">
																			{problem.testCases.length}
																		</span>
																	</div>
																</div>
															</div>

															<!-- Test Cases Progress Bar -->
															<div class="w-full">
																<div class="h-2 w-full rounded-full bg-muted">
																	<div
																		class="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
																		style="width: {problem.score}%"
																	></div>
																</div>
															</div>

															<!-- Individual Test Cases (First 3) -->
															<div class="space-y-2">
																{#each problem.testCases.slice(0, 3) as testCase, index (testCase.testCaseId)}
																	<div class="rounded-lg border border-border/30 bg-muted/30 p-3">
																		<div class="mb-2 flex items-center justify-between">
																			<span class="text-xs font-medium text-muted-foreground">
																				Test Case {index + 1}
																			</span>
																			{#if index < getPassedTestCases(problem)}
																				<CheckCircle class="h-4 w-4 text-green-500" />
																			{:else}
																				<XCircle class="h-4 w-4 text-red-500" />
																			{/if}
																		</div>
																		<div class="space-y-1 text-xs">
																			<div>
																				<span class="font-medium text-muted-foreground">Input:</span>
																				<code class="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-foreground">
																					{testCase.input.length > 30 ? testCase.input.slice(0, 30) + '...' : testCase.input}
																				</code>
																			</div>
																			<div>
																				<span class="font-medium text-muted-foreground">Expected:</span>
																				<code class="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-foreground">
																					{testCase.output.length > 30 ? testCase.output.slice(0, 30) + '...' : testCase.output}
																				</code>
																			</div>
																		</div>
																	</div>
																{/each}
																
																{#if problem.testCases.length > 3}
																	<div class="text-center">
																		<span class="text-xs text-muted-foreground">
																			+{problem.testCases.length - 3} more test cases
																		</span>
																	</div>
																{/if}
															</div>
														{:else}
															<div class="flex items-center justify-center py-4 text-sm text-muted-foreground">
																<FileText class="mr-2 h-4 w-4" />
																No test cases available
															</div>
														{/if}
													</div>
												</CardContent>
											</Card>
										{/each}
									</div>
								</div>
							{/if}
						</CardContent>
					</Card>
				{/each}
			</div>
		{/if}
	</div>
</div>
