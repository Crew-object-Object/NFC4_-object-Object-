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
	import { page } from '$app/stores';

	$: roomId = $page.params.roomId;
	import SendIcon from '@lucide/svelte/icons/send';
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
		return name
			?.split(' ')
			.map((word: string) => word[0])
			.join('')
			.toUpperCase()
			.slice(0, 2) || '?';
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
		if (!customProblemTitle.trim() || !customProblemDescription.trim() || !roomId || isLoadingProblems) return;
		
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
		if (!selectedInterviewProblem || !newTestCaseInput.trim() || !newTestCaseOutput.trim() || isLoadingProblems) return;
		
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

	// Check if current user is interviewer
	const isInterviewer = () => {
		// For now, we'll check based on the interview data when it's available
		// This will be improved when we have proper user role data
		return true; // Allow all users to manage problems for now
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
	<div class="h-full border rounded-lg overflow-hidden">
		<PaneGroup direction="horizontal">
			<!-- Editor Section -->
			<Pane defaultSize={60} minSize={40}>
				<PaneGroup direction="vertical">
					<!-- Code Editor -->
					<Pane defaultSize={75} minSize={50}>
						<div class="bg-background h-full flex flex-col">
							<div class="flex-1 px-4 py-2">
								<Tiptap />
							</div>
						</div>
					</Pane>

					<PaneResizer class="h-2 bg-border hover:bg-accent transition-colors flex items-center justify-center group">
						<div class="opacity-60 group-hover:opacity-100 transition-opacity">
							<GripHorizontalIcon size={16} />
						</div>
					</PaneResizer>

					<!-- Test Cases Section -->
					<Pane defaultSize={25} minSize={20}>
						<div class="bg-background h-full flex flex-col">
							<div class="px-4 py-2 border-b flex items-center justify-between">
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
											onclick={() => showProblemDialog = true}
										>
											<PlusIcon size={12} class="mr-1" />
											Add Problem
										</Button>
									</div>
								{/if}
							</div>
							<div class="flex-1 p-2 overflow-y-auto">
								{#if interviewProblems.length === 0}
									<div class="text-center text-muted-foreground text-sm py-8">
										<FlaskConicalIcon size={32} class="mx-auto mb-2 opacity-50" />
										<p>No problems added yet.</p>
										{#if isInterviewer()}
											<Button
												size="sm"
												variant="outline"
												class="mt-2"
												onclick={() => showProblemDialog = true}
											>
												Add First Problem
											</Button>
										{/if}
									</div>
								{:else}
									<div class="space-y-3">
										{#each interviewProblems as problem}
											<div class="border rounded-lg p-3">
												<div class="flex items-start justify-between mb-2">
													<div class="flex-1">
														<h4 class="text-sm font-semibold">{problem.title}</h4>
														<p class="text-xs text-muted-foreground mt-1 line-clamp-2">{problem.description}</p>
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
															<div class="border rounded p-2 bg-muted/50">
																<div class="flex items-center justify-between mb-1">
																	<span class="text-xs font-medium text-muted-foreground">Test Case {index + 1}</span>
																	<div class="w-2 h-2 bg-gray-400 rounded-full"></div>
																</div>
																<div class="grid grid-cols-2 gap-1">
																	<div>
																		<div class="text-xs font-medium text-muted-foreground mb-1">Input</div>
																		<div class="text-xs bg-background p-1 rounded border max-h-12 overflow-y-auto">{testCase.input}</div>
																	</div>
																	<div>
																		<div class="text-xs font-medium text-muted-foreground mb-1">Expected</div>
																		<div class="text-xs bg-background p-1 rounded border max-h-12 overflow-y-auto">{testCase.output}</div>
																	</div>
																</div>
															</div>
														{/each}
													</div>
												{:else}
													<div class="text-center text-muted-foreground text-xs py-2">
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

			<PaneResizer class="w-2 bg-border hover:bg-accent transition-colors flex items-center justify-center group">
				<div class="opacity-60 group-hover:opacity-100 transition-opacity">
					<GripVerticalIcon size={16} />
				</div>
			</PaneResizer>

			<!-- Right Side Panel -->
			<Pane defaultSize={40} minSize={30}>
				<PaneGroup direction="vertical">
					<!-- Video Section -->
					<Pane defaultSize={50} minSize={25}>
						<VideoCall {roomId} />
					</Pane>

					<PaneResizer class="h-2 bg-border hover:bg-accent transition-colors flex items-center justify-center group">
						<div class="opacity-60 group-hover:opacity-100 transition-opacity">
							<GripHorizontalIcon size={16} />
						</div>
					</PaneResizer>

					<!-- Chat Section -->
					<Pane defaultSize={50} minSize={25}>
						<div class="bg-background h-full flex flex-col">
							<div class="px-4 py-2 border-b flex items-center gap-2">
								<MessageCircleIcon size={16} />
								<h3 class="text-sm font-medium">Chat</h3>
								<span class="text-xs text-muted-foreground">({messages.length})</span>
							</div>
							<div 
								class="flex-1 p-4 overflow-y-auto" 
								bind:this={chatContainer}
							>
								{#if messages.length === 0}
									<div class="text-center text-muted-foreground text-sm py-8">
										<MessageCircleIcon size={32} class="mx-auto mb-2 opacity-50" />
										<p>No messages yet. Start the conversation!</p>
									</div>
								{:else}
									<div class="space-y-3">
										{#each messages as message (message.messageId)}
											<div class="flex items-start space-x-2">
												<div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
													{getInitials(message.from.name)}
												</div>
												<div class="flex-1 min-w-0">
													<div class="bg-muted rounded-lg p-3">
														<p class="text-sm break-words">{message.content}</p>
													</div>
													<div class="flex items-center gap-2 mt-1">
														<p class="text-xs text-muted-foreground">{message.from.name}</p>
														<span class="text-xs text-muted-foreground">•</span>
														<p class="text-xs text-muted-foreground">{formatTime(message.timestamp)}</p>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
							<div class="p-4 border-t">
								<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex space-x-2">
									<input 
										type="text" 
										placeholder="Type a message..." 
										class="flex-1 px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
										bind:value={newMessage}
										onkeypress={handleKeyPress}
										disabled={isLoading}
									/>
									<button 
										type="submit"
										class="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
										disabled={isLoading || !newMessage.trim()}
									>
										{#if isLoading}
											<div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
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
	<Sheet.Content side="right" class="w-full sm:max-w-2xl overflow-y-auto p-6">
		<Sheet.Header>
			<Sheet.Title>Add Problem to Interview</Sheet.Title>
			<Sheet.Description>
				Choose from predefined problems or create a custom one.
			</Sheet.Description>
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
				<h3 class="text-sm font-medium text-muted-foreground">Or choose from predefined problems:</h3>
				<div class="space-y-2 max-h-64 overflow-y-auto border rounded-lg">
					{#each availableProblems as problem}
						<button
							class="w-full text-left p-3 hover:bg-muted transition-colors border-b last:border-b-0"
							onclick={() => selectedProblem = problem}
						>
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<h4 class="font-medium text-sm">{problem.title}</h4>
									<p class="text-xs text-muted-foreground mt-1 line-clamp-2">{problem.description}</p>
								</div>
								<div class="flex items-center gap-2 ml-2">
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
				<div class="border rounded-lg p-4 bg-muted/50">
					<div class="flex items-center justify-between mb-2">
						<h4 class="font-semibold">{selectedProblem.title}</h4>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{selectedProblem.difficulty}</Badge>
							<Badge variant="secondary">{selectedProblem.testCases.length} test cases</Badge>
						</div>
					</div>
					<p class="text-sm text-muted-foreground mb-3">{selectedProblem.description}</p>
					<div class="text-xs text-muted-foreground">
						<strong>Tags:</strong> {selectedProblem.tags.join(', ')}
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
				disabled={isLoadingProblems || (!selectedProblem && (!customProblemTitle.trim() || !customProblemDescription.trim()))}
			>
				{#if isLoadingProblems}
					<div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
				{/if}
				Add Problem
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- Add Test Case Sheet -->
<Sheet.Root bind:open={showAddTestCaseDialog}>
	<Sheet.Content side="right" class="w-full sm:max-w-lg p-6">
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
					<div class="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
				{/if}
				Add Test Case
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
