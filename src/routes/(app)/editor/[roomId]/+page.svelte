<script lang="ts">
	import { page } from '$app/stores';
	import VideoCall from '$lib/components/video-call.svelte';
	import TiptapEditor from '$lib/components/tiptap.svelte';
	import InterviewChat from '$lib/components/interview-chat.svelte';
	import AddProblemDialog from '$lib/components/add-problem-dialog.svelte';
	import AddTestCaseDialog from '$lib/components/add-test-case-dialog.svelte';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import GripHorizontalIcon from '@lucide/svelte/icons/grip-horizontal';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CodeIcon from '@lucide/svelte/icons/code';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { Problem } from '$lib/problemset';
	import { browser } from '$app/environment';
	import { authClient, useSession } from '$lib/auth-client';
	import { sseClient } from '$lib/sse-client';
	import { onDestroy } from 'svelte';

	interface InterviewProblem {
		id: string;
		title: string;
		description: string;
		score: number;
		testCases: {
			testCaseId: string;
			input: string;
			output: string;
		}[];
	}

	// Problem management state
	let availableProblems = $state<Problem[]>([]);
	let interviewProblems = $state<InterviewProblem[]>([]);
	let showProblemDialog = $state(false);
	let showAddTestCaseDialog = $state(false);
	let selectedInterviewProblem = $state<InterviewProblem | null>(null);
	let isLoadingProblems = $state(false);

	// Get room ID from URL
	const roomId = $derived($page.params.roomId);

	// Fetch available problems from problemset
	const fetchAvailableProblems = async () => {
		try {
			const response = await fetch('/api/problemset');
			const result = await response.json();

			if (result.success) {
				availableProblems = result.data;
			} else {
				console.error('Failed to fetch problemset:', result.error);
			}
		} catch (error) {
			console.error('Error fetching problemset:', error);
		}
	};

	// Fetch problems for current interview
	const fetchInterviewProblems = async () => {
		if (!roomId) return;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`);
			const result = await response.json();

			if (result.success) {
				interviewProblems = result.data;
			} else {
				console.error('Failed to fetch interview problems:', result.error);
			}
		} catch (error) {
			console.error('Error fetching interview problems:', error);
		}
	};

	// Add selected problem from problemset to interview
	const handleAddProblemFromSet = async (event: CustomEvent<{ problem: Problem }>) => {
		if (!roomId || isLoadingProblems) return;

		isLoadingProblems = true;
		const { problem } = event.detail;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: problem.title,
					description: problem.description,
					testCases: problem.testCases
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showProblemDialog = false;
			} else {
				console.error('Failed to add problem:', result.error);
			}
		} catch (error) {
			console.error('Error adding problem:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// Add custom problem to interview
	const handleAddCustomProblem = async (
		event: CustomEvent<{ title: string; description: string }>
	) => {
		if (!roomId || isLoadingProblems) return;

		isLoadingProblems = true;
		const { title, description } = event.detail;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: title,
					description: description,
					testCases: []
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showProblemDialog = false;
			} else {
				console.error('Failed to add custom problem:', result.error);
			}
		} catch (error) {
			console.error('Error adding custom problem:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// Add test case to problem
	const handleAddTestCase = async (
		event: CustomEvent<{ input: string; output: string; problemId: string }>
	) => {
		if (isLoadingProblems) return;

		isLoadingProblems = true;
		const { input, output, problemId } = event.detail;

		try {
			const response = await fetch(`/api/problems/${problemId}/testcases`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					input: input,
					output: output
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showAddTestCaseDialog = false;
				selectedInterviewProblem = null;
			} else {
				console.error('Failed to add test case:', result.error);
			}
		} catch (error) {
			console.error('Error adding test case:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// State for code execution
	let currentCode = $state('');
	let selectedProblemForSubmission = $state<any>(null);
	let selectedTestCase = $state<any>(null);
	let isExecuting = $state(false);
	let executionResults = $state<any[]>([]);
	let currentExecutingTestCase = $state(-1); // Track which test case is currently executing
	let showSubmissionDialog = $state(false);

	// Function to handle code content changes from TiptapEditor
	const handleCodeChange = (code: string) => {
		currentCode = code;
	};

	// Submit code for execution
	const submitCode = async () => {
		if (!selectedProblemForSubmission || !currentCode.trim() || isExecuting) return;

		isExecuting = true;
		executionResults = [];
		currentExecutingTestCase = -1;

		try {
			// Run code against all test cases for the selected problem
			const testCases = selectedProblemForSubmission.testCases;

			for (let i = 0; i < testCases.length; i++) {
				const testCase = testCases[i];
				currentExecutingTestCase = i;

				try {
					const response = await fetch('/api/submit', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							code: currentCode,
							language_id: '10', // Python 3
							input: testCase.input
						})
					});

					const result = await response.json();

					if (result.error) {
						executionResults.push({
							testCaseIndex: i + 1,
							input: testCase.input,
							expectedOutput: testCase.output.trim(),
							actualOutput: '',
							passed: false,
							error: result.error,
							executionTime: 0,
							memory: 0,
							status: 'error'
						});
						continue;
					}

					// Compare output with expected
					const actualOutput = result.stdout?.trim() || '';
					const expectedOutput = testCase.output.trim();
					const passed = actualOutput === expectedOutput;

					executionResults.push({
						testCaseIndex: i + 1,
						input: testCase.input,
						expectedOutput: expectedOutput,
						actualOutput: actualOutput,
						passed: passed,
						error: result.stderr || null,
						executionTime: parseFloat(result.time) || 0,
						memory: parseInt(result.memory) || 0,
						status: result.status?.description || 'Unknown',
						statusId: result.status?.id || 0
					});
				} catch (error) {
					console.error(`Error executing test case ${i + 1}:`, error);
					executionResults.push({
						testCaseIndex: i + 1,
						input: testCase.input,
						expectedOutput: testCase.output,
						actualOutput: '',
						passed: false,
						error: 'Network error or execution failed',
						executionTime: 0,
						memory: 0,
						status: 'error',
						statusId: 0
					});
				}
			}
		} catch (error) {
			console.error('Error during code submission:', error);
		} finally {
			isExecuting = false;
			currentExecutingTestCase = -1;
		}
	};

	const session = useSession();

	// Check if current user is interviewer
	let isInterviewer = $state(false);

	// Check if current user is interviewee
	let isInterviewee = $state(false);

	$effect(() => {
		if (!$session.isPending) {
			isInterviewer = $session.data?.user.role === 'Interviewer';
			isInterviewee = !isInterviewer;
		}
	});
	
	// Tab switching detection for interviewees
	let isTabVisible = true;
	let tabSwitchCount = $state(0);
	let sseConnected = false;
	let lastTabSwitchTime = 0;
	let tabSwitchTimeout: ReturnType<typeof setTimeout> | null = null;

	const handleVisibilityChange = async () => {
		if (!browser || !roomId) return;

		const isCurrentlyVisible = !document.hidden;
		const currentTime = Date.now();

		console.log('Visibility change:', {
			isCurrentlyVisible,
			isTabVisible,
			isInterviewee: isInterviewee,
			roomId
		});

		// Only track tab switches for interviewees and when tab becomes hidden
		if (isInterviewee && isTabVisible && !isCurrentlyVisible) {
			console.log('Tab switch detected for interviewee');
			
			// Prevent multiple rapid notifications (debounce with 2 seconds)
			if (currentTime - lastTabSwitchTime < 2000) {
				console.log('Tab switch ignored due to debouncing');
				return;
			}

			// Clear any existing timeout
			if (tabSwitchTimeout) {
				clearTimeout(tabSwitchTimeout);
			}

			tabSwitchTimeout = setTimeout(async () => {
				tabSwitchCount++;
				lastTabSwitchTime = currentTime;

				console.log(`Interviewee switched tabs (count: ${tabSwitchCount})`);

				try {
					// Ensure SSE is connected before sending message
					if (!sseClient.isConnected) {
						await sseClient.connect(roomId);
					}

					// Send automatic message through SSE when tab is switched
					const message = `🚨 ALERT: Interviewee switched tabs (${tabSwitchCount} time${tabSwitchCount > 1 ? 's' : ''})`;
					await sseClient.sendMessage(message);
					console.log('Tab switch notification sent:', message);
				} catch (error) {
					console.error('Failed to send tab switch notification:', error);
				}
			}, 500); // 500ms delay to confirm it's a real tab switch
		}

		isTabVisible = isCurrentlyVisible;

		// Clear timeout if user returns to tab quickly
		if (isCurrentlyVisible && tabSwitchTimeout) {
			clearTimeout(tabSwitchTimeout);
			tabSwitchTimeout = null;
		}
	};

	const setupTabDetection = () => {
		if (!browser) return;
		
		console.log('Setting up tab detection event listeners');

		// Listen for visibility changes (tab switches, window minimizing, etc.)
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Also listen for blur/focus events as additional detection
		window.addEventListener('blur', () => {
			if (isInterviewee) {
				console.log('Window blur detected for interviewee');
				setTimeout(handleVisibilityChange, 100); // Small delay to ensure proper state
			}
		});

		// Reset tab visible state when gaining focus
		window.addEventListener('focus', () => {
			console.log('Window focus gained');
			isTabVisible = true;
		});
	};

	const cleanupTabDetection = () => {
		if (!browser) return;

		// Clear any pending timeout
		if (tabSwitchTimeout) {
			clearTimeout(tabSwitchTimeout);
			tabSwitchTimeout = null;
		}

		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('blur', handleVisibilityChange);
		window.removeEventListener('focus', () => {
			isTabVisible = true;
		});
	};

	// Initialize SSE connection for tab switching notifications
	const initializeSSEForTabDetection = async () => {
		if (!roomId || !isInterviewee) return;

		try {
			if (!sseClient.isConnected) {
				await sseClient.connect(roomId);
				sseConnected = true;
			}
		} catch (error) {
			console.error('Failed to connect SSE for tab detection:', error);
			sseConnected = false;
		}
	};

	$effect(() => {
		if (roomId) {
			// Debug role detection
			console.log('User role detection:', {
				isInterviewer: isInterviewer,
				isInterviewee: isInterviewee,
				urlParams: browser ? new URLSearchParams(window.location.search).get('role') : null
			});

			fetchInterviewProblems();
			if (isInterviewer) {
				fetchAvailableProblems();
			}

			// Setup tab switching detection for interviewees
			if (isInterviewee) {
				console.log('Setting up tab switching detection for interviewee');
				initializeSSEForTabDetection();
				setupTabDetection();
			}
		}
	});

	onDestroy(() => {
		// Cleanup tab detection
		cleanupTabDetection();

		// Disconnect SSE if we connected it for tab detection
		if (sseConnected && isInterviewee) {
			// Note: We don't disconnect SSE here because the chat component might be using it
			// The chat component will handle SSE disconnection
		}

		// Cleanup handled by individual components
	});
</script>

<main class="h-px grow px-4 py-0">
	<div class="h-full overflow-hidden rounded-lg border">
		<PaneGroup direction="horizontal">
			<!-- Editor Section -->
			<Pane defaultSize={60} minSize={40}>
				<PaneGroup direction="vertical">
					<!-- Code Editor -->
					<Pane defaultSize={75} minSize={50}>
						<div class="flex h-full flex-col bg-background">
							<div class="flex items-center justify-between border-b px-4 py-2">
								<div class="flex items-center gap-2">
									<CodeIcon size={16} />
									<h3 class="text-sm font-medium">Code Editor</h3>
									{#if isInterviewee && tabSwitchCount > 0}
										<Badge
											variant="outline"
											class="bg-orange-50 text-xs text-orange-600 dark:bg-orange-950 dark:text-orange-400"
											title="Number of times you've switched tabs (visible to interviewer)"
										>
											Tab switches: {tabSwitchCount}
										</Badge>
									{/if}
								</div>
								{#if isInterviewee}
									<div class="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											class="h-8 px-2 text-xs"
											onclick={() => (showSubmissionDialog = true)}
											disabled={!currentCode.trim() || interviewProblems.length === 0}
										>
											<PlayIcon size={12} class="mr-1" />
											Run Tests
										</Button>
									</div>
								{/if}
							</div>
							<div class="flex-1 p-4">
								<TiptapEditor {roomId} onContentChange={handleCodeChange} />
							</div>
						</div>
					</Pane>

					<PaneResizer
						class="group flex h-2 items-center justify-center bg-border transition-colors hover:bg-accent"
					>
						<div class="opacity-60 transition-opacity group-hover:opacity-100">
							<GripHorizontalIcon size={16} />
						</div>
					</PaneResizer>

					<!-- Test Cases Section -->
					<Pane defaultSize={25} minSize={20}>
						<div class="flex h-full flex-col bg-background">
							<div class="flex items-center justify-between border-b px-4 py-2">
								<div class="flex items-center gap-2">
									<FlaskConicalIcon size={16} />
									<h3 class="text-sm font-medium">Problems & Test Cases</h3>
								</div>
								{#if isInterviewer}
									<div class="flex items-center gap-1">
										<Button
											size="sm"
											variant="outline"
											class="h-8 px-2 text-xs"
											onclick={() => (showProblemDialog = true)}
										>
											<PlusIcon size={12} class="mr-1" />
											Add Problem
										</Button>
									</div>
								{/if}
							</div>
							<div class="flex-1 overflow-y-auto p-2">
								{#if interviewProblems.length === 0}
									<div class="py-8 text-center text-sm text-muted-foreground">
										<FlaskConicalIcon size={32} class="mx-auto mb-2 opacity-50" />
										<p>No problems added yet.</p>
										{#if isInterviewer}
											<Button
												size="sm"
												variant="outline"
												class="mt-2"
												onclick={() => (showProblemDialog = true)}
											>
												Add First Problem
											</Button>
										{/if}
									</div>
								{:else}
									<div class="space-y-3">
										{#each interviewProblems as problem}
											<div class="rounded-lg border p-3">
												<div class="mb-2 flex items-start justify-between">
													<div class="flex-1">
														<h4 class="text-sm font-semibold">{problem.title}</h4>
														<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
															{problem.description}
														</p>
													</div>
													{#if isInterviewer}
														<Button
															size="sm"
															variant="ghost"
															class="h-6 px-1 text-xs"
															onclick={() => {
																selectedInterviewProblem = problem;
																showAddTestCaseDialog = true;
															}}
														>
															<PlusIcon size={10} />
														</Button>
													{/if}
												</div>

												{#if problem.testCases.length > 0}
													<div class="space-y-2">
														{#each problem.testCases as testCase, index}
															<div class="rounded border bg-muted/50 p-2">
																<div class="mb-1 flex items-center justify-between">
																	<span class="text-xs font-medium text-muted-foreground"
																		>Test Case {index + 1}</span
																	>
																	<div class="h-2 w-2 rounded-full bg-gray-400"></div>
																</div>
																<div class="grid grid-cols-2 gap-1">
																	<div>
																		<div class="mb-1 text-xs font-medium text-muted-foreground">
																			Input
																		</div>
																		<div
																			class="max-h-12 overflow-y-auto rounded border bg-background p-1 text-xs"
																		>
																			{testCase.input}
																		</div>
																	</div>
																	<div>
																		<div class="mb-1 text-xs font-medium text-muted-foreground">
																			Expected
																		</div>
																		<div
																			class="max-h-12 overflow-y-auto rounded border bg-background p-1 text-xs"
																		>
																			{testCase.output}
																		</div>
																	</div>
																</div>
															</div>
														{/each}
													</div>
												{:else}
													<div class="py-2 text-center text-xs text-muted-foreground">
														No test cases added yet.
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</Pane>
				</PaneGroup>
			</Pane>

			<PaneResizer
				class="group flex w-2 items-center justify-center bg-border transition-colors hover:bg-accent"
			>
				<div class="opacity-60 transition-opacity group-hover:opacity-100">
					<GripVerticalIcon size={16} />
				</div>
			</PaneResizer>

			<!-- Right Side Panel -->
			<Pane defaultSize={40} minSize={30}>
				<PaneGroup direction="vertical">
					<!-- Video Section -->
					<Pane defaultSize={50} minSize={25}>
						{#if roomId}
							<VideoCall {roomId} />
						{/if}
					</Pane>

					<PaneResizer
						class="group flex h-2 items-center justify-center bg-border transition-colors hover:bg-accent"
					>
						<div class="opacity-60 transition-opacity group-hover:opacity-100">
							<GripHorizontalIcon size={16} />
						</div>
					</PaneResizer>

					<!-- Chat Section -->
					<Pane defaultSize={50} minSize={25}>
						{#if roomId}
							<InterviewChat {roomId} />
						{/if}
					</Pane>
				</PaneGroup>
			</Pane>
		</PaneGroup>
	</div>
</main>

<!-- Problem Management Components -->
<AddProblemDialog
	bind:open={showProblemDialog}
	{availableProblems}
	isLoading={isLoadingProblems}
	{roomId}
	on:close={() => (showProblemDialog = false)}
	on:addProblemFromSet={handleAddProblemFromSet}
	on:addCustomProblem={handleAddCustomProblem}
/>

<AddTestCaseDialog
	bind:open={showAddTestCaseDialog}
	selectedProblem={selectedInterviewProblem}
	isLoading={isLoadingProblems}
	on:close={() => {
		showAddTestCaseDialog = false;
		selectedInterviewProblem = null;
	}}
	on:addTestCase={handleAddTestCase}
/>

<!-- Code Submission Sheet -->
<Sheet.Root bind:open={showSubmissionDialog}>
	<Sheet.Content side="right" class="max-h-screen w-full overflow-y-auto p-6 sm:max-w-4xl">
		<Sheet.Header>
			<Sheet.Title>Run Code Tests</Sheet.Title>
			<Sheet.Description>
				Select a problem and run your code against its test cases.
			</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-6 py-6">
			<!-- Problem Selection -->
			<div class="space-y-3">
				<Label>Select Problem</Label>
				<Select.Root
					type="single"
					value={selectedProblemForSubmission?.id}
					onValueChange={(value) => {
						selectedProblemForSubmission = interviewProblems.find((p) => p.id === value) || null;
					}}
				>
					<Select.Trigger class="w-full">
						<span class="truncate">
							{selectedProblemForSubmission?.title || 'Choose a problem to test...'}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each interviewProblems as problem}
							<Select.Item value={problem.id}>
								{problem.title} ({problem.testCases.length} test cases)
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if selectedProblemForSubmission}
				<!-- Problem Details -->
				<div class="rounded-lg border bg-muted/50 p-4">
					<h3 class="mb-2 font-semibold">{selectedProblemForSubmission.title}</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						{selectedProblemForSubmission.description}
					</p>
					<div class="text-xs text-muted-foreground">
						<strong>Test Cases:</strong>
						{selectedProblemForSubmission.testCases.length}
					</div>
				</div>

				<!-- Execution Results -->
				{#if isExecuting || executionResults.length > 0}
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-medium">Test Results</h3>
							{#if isExecuting}
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<div
										class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
									></div>
									{#if currentExecutingTestCase >= 0}
										Running test case {currentExecutingTestCase + 1}/{selectedProblemForSubmission
											?.testCases?.length || 0}
									{:else}
										Preparing execution...
									{/if}
								</div>
							{/if}
						</div>

						<div class="max-h-[60vh] min-h-64 overflow-y-auto rounded-lg border">
							<div class="p-3">
								<div class="space-y-3">
									{#if isExecuting}
										<!-- Show progress for test cases -->
										{#each Array(selectedProblemForSubmission?.testCases?.length || 0) as _, index}
											<div
												class="rounded-lg border p-3 {index < executionResults.length
													? executionResults[index].passed
														? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
														: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
													: index === currentExecutingTestCase
														? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
														: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'}"
											>
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-medium">Test Case {index + 1}</span>
													{#if index < executionResults.length}
														<Badge
															variant={executionResults[index].passed ? 'default' : 'destructive'}
															class="text-xs"
														>
															{executionResults[index].passed ? 'PASSED' : 'FAILED'}
														</Badge>
													{:else if index === currentExecutingTestCase}
														<div class="flex items-center gap-1">
															<div
																class="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
															></div>
															<span class="text-xs text-blue-600">Running...</span>
														</div>
													{:else}
														<Badge variant="outline" class="text-xs">Pending</Badge>
													{/if}
												</div>

												{#if index < executionResults.length}
													<!-- Show completed result -->
													<div class="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Input</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
															>
																{executionResults[index].input}
															</div>
														</div>
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Expected</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
															>
																{executionResults[index].expectedOutput}
															</div>
														</div>
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Your Output</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs {executionResults[
																	index
																].passed
																	? 'text-green-600'
																	: 'text-red-600'}"
															>
																{executionResults[index].actualOutput || 'No output'}
															</div>
														</div>
													</div>

													{#if executionResults[index].error}
														<div class="mt-2">
															<div class="mb-1 text-xs font-medium text-muted-foreground">
																Error
															</div>
															<div
																class="max-h-20 overflow-y-auto rounded border bg-red-100 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
															>
																{executionResults[index].error}
															</div>
														</div>
													{/if}

													<div
														class="mt-2 flex items-center justify-between text-xs text-muted-foreground"
													>
														<span
															>Time: {executionResults[index].executionTime?.toFixed(3) ||
																'0.000'}s</span
														>
														<div class="flex gap-3">
															<span>Memory: {executionResults[index].memory || 0} KB</span>
															{#if executionResults[index].status}
																<span>Status: {executionResults[index].status}</span>
															{/if}
														</div>
													</div>
												{:else if index === currentExecutingTestCase}
													<!-- Show skeleton for currently executing test -->
													<div class="space-y-2">
														<Skeleton class="h-4 w-full" />
														<Skeleton class="h-4 w-3/4" />
														<Skeleton class="h-4 w-1/2" />
													</div>
												{:else}
													<!-- Show placeholder for pending tests -->
													<div class="text-xs text-muted-foreground">Waiting in queue...</div>
												{/if}
											</div>
										{/each}
									{:else}
										<!-- Show completed results -->
										{#each executionResults as result}
											<div
												class="rounded-lg border p-3 {result.passed
													? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
													: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}"
											>
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-medium">Test Case {result.testCaseIndex}</span>
													<Badge
														variant={result.passed ? 'default' : 'destructive'}
														class="text-xs"
													>
														{result.passed ? 'PASSED' : 'FAILED'}
													</Badge>
												</div>

												<div class="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Input</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
														>
															{result.input}
														</div>
													</div>
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Expected</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
														>
															{result.expectedOutput}
														</div>
													</div>
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Your Output</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs {result.passed
																? 'text-green-600'
																: 'text-red-600'}"
														>
															{result.actualOutput || 'No output'}
														</div>
													</div>
												</div>

												{#if result.error}
													<div class="mt-2">
														<div class="mb-1 text-xs font-medium text-muted-foreground">Error</div>
														<div
															class="max-h-20 overflow-y-auto rounded border bg-red-100 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
														>
															{result.error}
														</div>
													</div>
												{/if}

												<div
													class="mt-2 flex items-center justify-between text-xs text-muted-foreground"
												>
													<span>Time: {result.executionTime?.toFixed(3) || '0.000'}s</span>
													<div class="flex gap-3">
														<span>Memory: {result.memory || 0} KB</span>
														{#if result.status}
															<span>Status: {result.status}</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									{/if}

									<!-- Summary -->
									{#if !isExecuting && executionResults.length > 0}
										<div class="mt-3 rounded-lg bg-muted p-3">
											<div class="mb-1 text-sm font-medium">
												Results: {executionResults.filter((r) => r.passed)
													.length}/{executionResults.length} tests passed
											</div>
											<div class="text-xs text-muted-foreground">
												{#if executionResults.every((r) => r.passed)}
													🎉 All tests passed! Great job!
												{:else if executionResults.some((r) => r.passed)}
													{executionResults.filter((r) => r.passed).length} tests passed. Keep working
													on the remaining ones!
												{:else}
													No tests passed. Review the errors and try again.
												{/if}
											</div>

											<!-- Overall stats -->
											<div class="mt-2 flex gap-4 text-xs text-muted-foreground">
												<span
													>Avg Time: {(
														executionResults.reduce((sum, r) => sum + (r.executionTime || 0), 0) /
														executionResults.length
													).toFixed(3)}s</span
												>
												<span
													>Max Memory: {Math.max(...executionResults.map((r) => r.memory || 0))} KB</span
												>
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div class="flex gap-2 pt-6">
			<Button
				variant="outline"
				onclick={() => {
					showSubmissionDialog = false;
					selectedProblemForSubmission = null;
					executionResults = [];
				}}
			>
				Close
			</Button>
			<Button
				onclick={submitCode}
				disabled={isExecuting || !selectedProblemForSubmission || !currentCode.trim()}
			>
				{#if isExecuting}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
					{#if currentExecutingTestCase >= 0}
						Running Test {currentExecutingTestCase + 1}/{selectedProblemForSubmission?.testCases
							?.length || 0}
					{:else}
						Preparing Tests...
					{/if}
				{:else}
					<PlayIcon size={16} class="mr-2" />
					Run Tests ({selectedProblemForSubmission?.testCases?.length || 0})
				{/if}
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
