<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { useSession } from '$lib/auth-client';
	import Tiptap from '$lib/components/tiptap.svelte';
	import VideoCall from '$lib/components/video-call.svelte';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import GripHorizontalIcon from '@lucide/svelte/icons/grip-horizontal';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';

	import SendIcon from '@lucide/svelte/icons/send';
	import CodeIcon from '@lucide/svelte/icons/code';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { Problem } from '$lib/problemset';

	const session = useSession();

	interface Message {
		messageId: string;
		content: string;
		timestamp: string;
		from: {
			id: string;
			name: string;
			image?: string;
		};
	}

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

	// Chat state
	let messages: Message[] = [];
	let newMessage = '';
	let chatContainer: HTMLDivElement;
	let isLoading = false;
	let pollingInterval: NodeJS.Timeout | null = null;
	let lastMessageCount = 0;

	// Problem management state
	let availableProblems: Problem[] = [];
	let interviewProblems: InterviewProblem[] = [];
	let showProblemDialog = false;
	let showAddTestCaseDialog = false;
	let selectedProblem: Problem | null = null;
	let selectedInterviewProblem: InterviewProblem | null = null;
	let customProblemTitle = '';
	let customProblemDescription = '';
	let newTestCaseInput = '';
	let newTestCaseOutput = '';
	let isLoadingProblems = false;

	// Get room ID from URL
	$: roomId = $page.params.roomId;

	// Fetch messages from API
	const fetchMessages = async () => {
		if (!roomId) return;

		try {
			const response = await fetch(`/api/messages/${roomId}`);
			const result = await response.json();

			if (result.success) {
				messages = result.data;
				// Auto-scroll to bottom if new messages arrived
				if (messages.length > lastMessageCount) {
					setTimeout(scrollToBottom, 100);
					lastMessageCount = messages.length;
				}
			} else {
				console.error('Failed to fetch messages:', result.error);
			}
		} catch (error) {
			console.error('Error fetching messages:', error);
		}
	};

	// Send a new message
	const sendMessage = async () => {
		if (!newMessage.trim() || isLoading || !roomId) return;

		const messageContent = newMessage.trim();
		newMessage = '';
		isLoading = true;

		try {
			const response = await fetch(`/api/messages/${roomId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content: messageContent
				})
			});

			const result = await response.json();

			if (result.success) {
				// Immediately fetch latest messages to update UI
				await fetchMessages();
			} else {
				console.error('Failed to send message:', result.error);
				// Restore message on failure
				newMessage = messageContent;
			}
		} catch (error) {
			console.error('Error sending message:', error);
			// Restore message on failure
			newMessage = messageContent;
		} finally {
			isLoading = false;
		}
	};

	// Handle Enter key press
	const handleKeyPress = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	};

	// Scroll to bottom of chat
	const scrollToBottom = () => {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	};

	// Format timestamp
	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

		return date.toLocaleDateString();
	};

	// Get user initials for avatar
	const getInitials = (name: string) => {
		return (
			name
				?.split(' ')
				.map((word: string) => word[0])
				.join('')
				.toUpperCase()
				.slice(0, 2) || '?'
		);
	};

	// Start polling for new messages
	const startPolling = () => {
		// Initial fetch
		fetchMessages();

		// Poll every 500 milliseconds
		pollingInterval = setInterval(fetchMessages, 500);
	};

	// Stop polling
	const stopPolling = () => {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
	};

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
	const addProblemFromSet = async () => {
		if (!selectedProblem || !roomId || isLoadingProblems) return;

		isLoadingProblems = true;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: selectedProblem.title,
					description: selectedProblem.description,
					testCases: selectedProblem.testCases
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showProblemDialog = false;
				selectedProblem = null;
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
	const addCustomProblem = async () => {
		if (
			!customProblemTitle.trim() ||
			!customProblemDescription.trim() ||
			!roomId ||
			isLoadingProblems
		)
			return;

		isLoadingProblems = true;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: customProblemTitle.trim(),
					description: customProblemDescription.trim(),
					testCases: []
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showProblemDialog = false;
				customProblemTitle = '';
				customProblemDescription = '';
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
	const addTestCase = async () => {
		if (
			!selectedInterviewProblem ||
			!newTestCaseInput.trim() ||
			!newTestCaseOutput.trim() ||
			isLoadingProblems
		)
			return;

		isLoadingProblems = true;

		try {
			const response = await fetch(`/api/problems/${selectedInterviewProblem.id}/testcases`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					input: newTestCaseInput.trim(),
					output: newTestCaseOutput.trim()
				})
			});

			const result = await response.json();

			if (result.success) {
				await fetchInterviewProblems();
				showAddTestCaseDialog = false;
				selectedInterviewProblem = null;
				newTestCaseInput = '';
				newTestCaseOutput = '';
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
	let currentCode = '';
	let selectedProblemForSubmission: any = null;
	let selectedTestCase: any = null;
	let isExecuting = false;
	let executionResults: any[] = [];
	let showSubmissionDialog = false;

	// Submit code for execution
	const submitCode = async () => {
		if (!selectedProblemForSubmission || !currentCode.trim() || isExecuting) return;
		
		isExecuting = true;
		executionResults = [];
		
		try {
			// Run code against all test cases for the selected problem
			const testCases = selectedProblemForSubmission.testCases;
			
			for (let i = 0; i < testCases.length; i++) {
				const testCase = testCases[i];
				
				try {
					const response = await fetch('/api/submit', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							code: currentCode,
							language_id: '71', // Python 3
							input: testCase.input
						})
					});
					
					const result = await response.json();
					
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
						executionTime: result.time || 0,
						memory: result.memory || 0
					});
					
				} catch (error) {
					console.error(`Error executing test case ${i + 1}:`, error);
					executionResults.push({
						testCaseIndex: i + 1,
						input: testCase.input,
						expectedOutput: testCase.output,
						actualOutput: '',
						passed: false,
						error: 'Execution failed',
						executionTime: 0,
						memory: 0
					});
				}
			}
			
		} catch (error) {
			console.error('Error during code submission:', error);
		} finally {
			isExecuting = false;
		}
	};

	// Check if current user is interviewer
	const isInterviewer = () => {
		// For now, we'll check based on the interview data when it's available
		// This will be improved when we have proper user role data
		return true; // Allow all users to manage problems for now
	};

	// Check if current user is interviewee  
	const isInterviewee = () => {
		// For now, return true for non-interviewers
		// This will be improved when we have proper user role data
		return true;
	};

	onMount(() => {
		if (roomId) {
			startPolling();
			fetchInterviewProblems();
			if (isInterviewer()) {
				fetchAvailableProblems();
			}
		}
	});

	onDestroy(() => {
		stopPolling();
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
						<div class="bg-background h-full flex flex-col">
							<div class="px-4 py-2 border-b flex items-center justify-between">
								<div class="flex items-center gap-2">
									<CodeIcon size={16} />
									<h3 class="text-sm font-medium">Code Editor</h3>
								</div>
								{#if isInterviewee()}
									<div class="flex items-center gap-2">
										<Button
											size="sm"
											variant="outline"
											class="h-8 px-2 text-xs"
											onclick={() => showSubmissionDialog = true}
											disabled={!currentCode.trim() || interviewProblems.length === 0}
										>
											<PlayIcon size={12} class="mr-1" />
											Run Tests
										</Button>
									</div>
								{/if}
							</div>
							<div class="flex-1 p-4">
								<Textarea
									bind:value={currentCode}
									placeholder="Write your code here..."
									class="h-full resize-none font-mono text-sm"
									rows={20}
								/>
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
								{#if isInterviewer()}
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
										{#if isInterviewer()}
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
													{#if isInterviewer()}
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
						<div class="flex h-full flex-col bg-background">
							<div class="flex items-center gap-2 border-b px-4 py-2">
								<MessageCircleIcon size={16} />
								<h3 class="text-sm font-medium">Chat</h3>
								<span class="text-xs text-muted-foreground">({messages.length})</span>
							</div>
							<div class="flex-1 overflow-y-auto p-4" bind:this={chatContainer}>
								{#if messages.length === 0}
									<div class="py-8 text-center text-sm text-muted-foreground">
										<MessageCircleIcon size={32} class="mx-auto mb-2 opacity-50" />
										<p>No messages yet. Start the conversation!</p>
									</div>
								{:else}
									<div class="space-y-3">
										{#each messages as message (message.messageId)}
											<div class="flex items-start space-x-2">
												<div
													class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
												>
													{getInitials(message.from.name)}
												</div>
												<div class="min-w-0 flex-1">
													<div class="rounded-lg bg-muted p-3">
														<p class="text-sm break-words">{message.content}</p>
													</div>
													<div class="mt-1 flex items-center gap-2">
														<p class="text-xs text-muted-foreground">{message.from.name}</p>
														<span class="text-xs text-muted-foreground">•</span>
														<p class="text-xs text-muted-foreground">
															{formatTime(message.timestamp)}
														</p>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
							<div class="border-t p-4">
								<form
									onsubmit={(e) => {
										e.preventDefault();
										sendMessage();
									}}
									class="flex space-x-2"
								>
									<input
										type="text"
										placeholder="Type a message..."
										class="flex-1 rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50"
										bind:value={newMessage}
										onkeypress={handleKeyPress}
										disabled={isLoading}
									/>
									<button
										type="submit"
										class="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
										disabled={isLoading || !newMessage.trim()}
									>
										{#if isLoading}
											<div
												class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
											></div>
										{:else}
											<SendIcon size={14} />
										{/if}
										Send
									</button>
								</form>
							</div>
						</div>
					</Pane>
				</PaneGroup>
			</Pane>
		</PaneGroup>
	</div>
</main>

<!-- Problem Selection Sheet -->
<Sheet.Root bind:open={showProblemDialog}>
	<Sheet.Content side="right" class="w-full overflow-y-auto p-6 sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>Add Problem to Interview</Sheet.Title>
			<Sheet.Description>Choose from predefined problems or create a custom one.</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-6 py-6">
			<!-- Custom Problem Form -->
			<div class="space-y-4">
				<div>
					<Label for="problem-title">Problem Title</Label>
					<Input
						id="problem-title"
						bind:value={customProblemTitle}
						placeholder="Enter problem title..."
						class="mt-1"
					/>
				</div>
				<div>
					<Label for="problem-description">Problem Description</Label>
					<Textarea
						id="problem-description"
						bind:value={customProblemDescription}
						placeholder="Enter problem description..."
						rows={6}
						class="mt-1"
					/>
				</div>
			</div>

			<!-- Predefined Problems List -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-muted-foreground">
					Or choose from predefined problems:
				</h3>
				<div class="max-h-64 space-y-2 overflow-y-auto rounded-lg border">
					{#each availableProblems as problem}
						<button
							class="w-full border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted"
							onclick={() => (selectedProblem = problem)}
						>
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<h4 class="text-sm font-medium">{problem.title}</h4>
									<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
										{problem.description}
									</p>
								</div>
								<div class="ml-2 flex items-center gap-2">
									<Badge variant="outline" class="text-xs">
										{problem.difficulty}
									</Badge>
									<Badge variant="secondary" class="text-xs">
										{problem.testCases.length} tests
									</Badge>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>

			{#if selectedProblem}
				<!-- Selected Problem Preview -->
				<div class="rounded-lg border bg-muted/50 p-4">
					<div class="mb-2 flex items-center justify-between">
						<h4 class="font-semibold">{selectedProblem.title}</h4>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{selectedProblem.difficulty}</Badge>
							<Badge variant="secondary">{selectedProblem.testCases.length} test cases</Badge>
						</div>
					</div>
					<p class="mb-3 text-sm text-muted-foreground">{selectedProblem.description}</p>
					<div class="text-xs text-muted-foreground">
						<strong>Tags:</strong>
						{selectedProblem.tags.join(', ')}
					</div>
				</div>
			{/if}
		</div>

		<div class="flex gap-2 pt-6">
			<Button
				variant="outline"
				onclick={() => {
					showProblemDialog = false;
					selectedProblem = null;
					customProblemTitle = '';
					customProblemDescription = '';
				}}
			>
				Cancel
			</Button>
			<Button
				onclick={selectedProblem ? addProblemFromSet : addCustomProblem}
				disabled={isLoadingProblems ||
					(!selectedProblem && (!customProblemTitle.trim() || !customProblemDescription.trim()))}
			>
				{#if isLoadingProblems}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
				{/if}
				Add Problem
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- Add Test Case Sheet -->
<Sheet.Root bind:open={showAddTestCaseDialog}>
	<Sheet.Content side="right" class="w-full p-6 sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>Add Test Case</Sheet.Title>
			<Sheet.Description>
				Add a new test case to "{selectedInterviewProblem?.title}".
			</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-4 py-6">
			<div>
				<Label for="test-input">Input</Label>
				<Textarea
					id="test-input"
					bind:value={newTestCaseInput}
					placeholder="Enter test input..."
					rows={3}
					class="mt-1"
				/>
			</div>
			<div>
				<Label for="test-output">Expected Output</Label>
				<Textarea
					id="test-output"
					bind:value={newTestCaseOutput}
					placeholder="Enter expected output..."
					rows={3}
					class="mt-1"
				/>
			</div>
		</div>

		<div class="flex gap-2 pt-6">
			<Button
				variant="outline"
				onclick={() => {
					showAddTestCaseDialog = false;
					selectedInterviewProblem = null;
					newTestCaseInput = '';
					newTestCaseOutput = '';
				}}
			>
				Cancel
			</Button>
			<Button
				onclick={addTestCase}
				disabled={isLoadingProblems || !newTestCaseInput.trim() || !newTestCaseOutput.trim()}
			>
				{#if isLoadingProblems}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
				{/if}
				Add Test Case
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- Code Submission Sheet -->
<Sheet.Root bind:open={showSubmissionDialog}>
	<Sheet.Content side="right" class="w-full sm:max-w-4xl p-6">
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
						selectedProblemForSubmission = interviewProblems.find(p => p.id === value) || null;
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
				<div class="border rounded-lg p-4 bg-muted/50">
					<h3 class="font-semibold mb-2">{selectedProblemForSubmission.title}</h3>
					<p class="text-sm text-muted-foreground mb-3">{selectedProblemForSubmission.description}</p>
					<div class="text-xs text-muted-foreground">
						<strong>Test Cases:</strong> {selectedProblemForSubmission.testCases.length}
					</div>
				</div>

				<!-- Execution Results -->
				{#if executionResults.length > 0}
					<div class="space-y-3">
						<h3 class="text-sm font-medium">Test Results</h3>
						{#each executionResults as result}
							<div class="border rounded-lg p-3 {result.passed ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium">Test Case {result.testCaseIndex}</span>
									<Badge variant={result.passed ? 'default' : 'destructive'} class="text-xs">
										{result.passed ? 'PASSED' : 'FAILED'}
									</Badge>
								</div>
								
								<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
									<div>
										<div class="font-medium text-muted-foreground mb-1">Input</div>
										<div class="bg-background p-2 rounded border max-h-20 overflow-y-auto font-mono">{result.input}</div>
									</div>
									<div>
										<div class="font-medium text-muted-foreground mb-1">Expected Output</div>
										<div class="bg-background p-2 rounded border max-h-20 overflow-y-auto font-mono">{result.expectedOutput}</div>
									</div>
									<div>
										<div class="font-medium text-muted-foreground mb-1">Your Output</div>
										<div class="bg-background p-2 rounded border max-h-20 overflow-y-auto font-mono {result.passed ? 'text-green-600' : 'text-red-600'}">{result.actualOutput || 'No output'}</div>
									</div>
								</div>
								
								{#if result.error}
									<div class="mt-2">
										<div class="font-medium text-muted-foreground mb-1 text-xs">Error</div>
										<div class="bg-red-100 dark:bg-red-950 p-2 rounded border text-xs font-mono text-red-700 dark:text-red-300">{result.error}</div>
									</div>
								{/if}
								
								<div class="flex justify-between items-center mt-2 text-xs text-muted-foreground">
									<span>Execution Time: {result.executionTime}s</span>
									<span>Memory: {result.memory} KB</span>
								</div>
							</div>
						{/each}
						
						<!-- Summary -->
						<div class="bg-muted p-3 rounded-lg">
							<div class="text-sm font-medium mb-1">
								Results: {executionResults.filter(r => r.passed).length}/{executionResults.length} tests passed
							</div>
							<div class="text-xs text-muted-foreground">
								{#if executionResults.every(r => r.passed)}
									🎉 All tests passed! Great job!
								{:else}
									Keep working on it. Review the failed test cases above.
								{/if}
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
					<div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
					Running Tests...
				{:else}
					<PlayIcon size={16} class="mr-2" />
					Run Tests
				{/if}
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
