<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Card from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import { Bot, Send, Zap, Clock, Database } from 'lucide-svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { marked } from 'marked';

	interface Props {
		currentCode: string;
		roomId: string;
	}

	let { currentCode, roomId }: Props = $props();

	// Configure marked for better security and rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	interface ComplexityAnalysis {
		timeComplexity: string;
		spaceComplexity: string;
		analysis: {
			nestedLoops: number;
			hasRecursion: boolean;
			hasArrayAllocation: boolean;
			hasHashMap: boolean;
			inputProvided: boolean;
		};
	}

	let input = $state('');

	// Initialize the Chat component with proper API configuration
	const chat = new Chat({
		onFinish: (message) => {
			console.log('Chat finished:', message);
		},
		onError: (error) => {
			console.error('Chat error:', error);
		}
	});

	// Function to convert markdown to HTML
	function renderMarkdown(text: string): string {
		try {
			const result = marked.parse(text);
			return typeof result === 'string' ? result : '';
		} catch (error) {
			console.error('Error parsing markdown:', error);
			return text; // Fallback to plain text
		}
	}

	const analyzeComplexity = async () => {
		if (!currentCode.trim()) {
			return;
		}

		const message = `I need you to analyze the complexity of this code. Please call the analyzeComplexity tool with the following code:

\`\`\`
${currentCode}
\`\`\``;
		
		console.log('Sending complexity analysis request');
		await chat.sendMessage({ text: message });
	};

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!input.trim()) return;

		const message = input;
		input = '';

		console.log('Sending chat message:', message);
		await chat.sendMessage({ text: message });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit(event as any);
		}
	}

	const getComplexityColor = (complexity: string) => {
		switch (complexity) {
			case 'O(1)':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'O(log n)':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
			case 'O(n)':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
			case 'O(n log n)':
				return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
			case 'O(n^2)':
			case 'O(n^3)':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			case 'O(2^n)':
			case 'O(n!)':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
		}
	};

	// Create a reactive variable to track loading state
	const isLoading = $derived(
		chat.messages.length > 0 &&
			chat.messages[chat.messages.length - 1]?.role === 'user' &&
			chat.messages.length % 2 === 1
	);
</script>

<!-- Floating Chatbot Button -->
<!-- Chatbot Content -->
<div class="flex h-full flex-col">
	<!-- Quick Actions -->
	<div class="border-b bg-muted/30 p-4">
		<div class="flex flex-wrap gap-2">
			<Button
				size="sm"
				variant="outline"
				class="gap-2"
				onclick={analyzeComplexity}
				disabled={isLoading || !currentCode.trim()}
			>
				{#if isLoading}
					<div
						class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
					></div>
					Analyzing...
				{:else}
					<Zap size={14} />
					Analyze Code Complexity
				{/if}
			</Button>
		</div>
	</div>

	<!-- Chat Messages -->
	<ScrollArea class="flex-1 p-4">
		<div class="space-y-4">
			{#if chat.messages.length === 0}
				<div class="flex h-96 items-center justify-center">
					<div class="text-center">
						<div class="mb-4 flex justify-center">
							<div class="rounded-full bg-primary/10 p-4">
								<Bot class="h-8 w-8 text-primary" />
							</div>
						</div>
						<h2 class="mb-2 text-xl font-semibold text-foreground">AI Interview Assistant</h2>
						<p class="text-muted-foreground">
							I can help you analyze code complexity, understand algorithms, and provide insights
							during the interview.
						</p>
					</div>
				</div>
			{:else}
				<div class="space-y-4 pr-4">
					{#each chat.messages as message, messageIndex}
						<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
							{#if message.role === 'assistant'}
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
								>
									<Bot size={16} class="text-primary" />
								</div>
							{/if}

									<div class="max-w-[80%] space-y-2">
										<div
											class="rounded-lg px-3 py-2 text-sm {message.role === 'user'
												? 'bg-primary text-primary-foreground'
												: 'bg-muted'}"
										>
											{#each message.parts as part, partIndex}
												{#if part.type === 'text'}
													<div
														class="prose prose-sm max-w-none {message.role === 'user'
															? 'prose-invert [&_*]:text-primary-foreground [&_code]:text-primary-foreground [&_pre]:bg-primary-foreground/10 [&_pre_code]:text-primary-foreground'
															: 'prose-neutral dark:prose-invert [&_code]:bg-muted [&_code]:text-foreground [&_pre]:bg-muted'} [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_pre]:rounded-md [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
													>
														{@html renderMarkdown(part.text)}
													</div>
												{:else if part.type === 'tool-analyzeComplexity'}
													<!-- Display tool results -->
													{#if part.state === 'output-available' && part.output}
														{@const analysis = part.output as ComplexityAnalysis}
														{#if analysis.timeComplexity && analysis.spaceComplexity}
															<Card.Root class="mt-2">
																<Card.Header class="pb-3">
																	<Card.Title class="flex items-center gap-2 text-sm">
																		<Zap size={16} />
																		Complexity Analysis
																	</Card.Title>
																</Card.Header>
																<Card.Content class="space-y-4">
																	<!-- Time & Space Complexity -->
																	<div class="grid grid-cols-2 gap-4">
																		<div class="space-y-2">
																			<div
																				class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
																			>
																				<Clock size={12} />
																				Time Complexity
																			</div>
																			<Badge
																				variant="secondary"
																				class="font-mono text-sm {getComplexityColor(
																					analysis.timeComplexity
																				)}"
																			>
																				{analysis.timeComplexity}
																			</Badge>
																		</div>
																		<div class="space-y-2">
																			<div
																				class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
																			>
																				<Database size={12} />
																				Space Complexity
																			</div>
																			<Badge
																				variant="secondary"
																				class="font-mono text-sm {getComplexityColor(
																					analysis.spaceComplexity
																				)}"
																			>
																				{analysis.spaceComplexity}
																			</Badge>
																		</div>
																	</div>

																	<!-- Analysis Details -->
																	{#if analysis.analysis}
																		<div class="space-y-2">
																			<div class="text-xs font-medium text-muted-foreground">
																				Analysis Details
																			</div>
																			<div class="grid grid-cols-2 gap-2 text-xs">
																				<div class="flex items-center justify-between">
																					<span>Nested Loops:</span>
																					<Badge variant="outline" class="text-xs">
																						{analysis.analysis.nestedLoops}
																					</Badge>
																				</div>
																				<div class="flex items-center justify-between">
																					<span>Has Recursion:</span>
																					<Badge
																						variant={analysis.analysis.hasRecursion
																							? 'default'
																							: 'outline'}
																						class="text-xs"
																					>
																						{analysis.analysis.hasRecursion ? 'Yes' : 'No'}
																					</Badge>
																				</div>
																				<div class="flex items-center justify-between">
																					<span>Array Allocation:</span>
																					<Badge
																						variant={analysis.analysis.hasArrayAllocation
																							? 'default'
																							: 'outline'}
																						class="text-xs"
																					>
																						{analysis.analysis.hasArrayAllocation ? 'Yes' : 'No'}
																					</Badge>
																				</div>
																				<div class="flex items-center justify-between">
																					<span>Hash Map Usage:</span>
																					<Badge
																						variant={analysis.analysis.hasHashMap
																							? 'default'
																							: 'outline'}
																						class="text-xs"
																					>
																						{analysis.analysis.hasHashMap ? 'Yes' : 'No'}
																					</Badge>
																				</div>
																			</div>
																		</div>
																	{/if}
																</Card.Content>
															</Card.Root>
														{/if}
													{/if}
												{/if}
											{/each}
										</div>

										<div
											class="text-xs text-muted-foreground {message.role === 'user'
												? 'text-right'
												: 'text-left'}"
										>
											{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</div>
									</div>

									{#if message.role === 'user'}
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary"
										>
											<span class="text-xs font-medium text-primary-foreground">You</span>
										</div>
									{/if}
							</div>
					{/each}

					<!-- Loading indicator -->
					{#if isLoading}
						<div class="flex justify-start gap-3">
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
							>
								<Bot size={16} class="text-primary" />
							</div>
							<div class="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
								<div class="flex gap-1">
									<div class="h-2 w-2 animate-bounce rounded-full bg-primary/60"></div>
									<div
										class="h-2 w-2 animate-bounce rounded-full bg-primary/60"
										style="animation-delay: 0.1s"
									></div>
									<div
										class="h-2 w-2 animate-bounce rounded-full bg-primary/60"
										style="animation-delay: 0.2s"
									></div>
								</div>
								<span class="text-xs text-muted-foreground">AI is thinking...</span>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</ScrollArea>

		<!-- Input Area -->
		<div class="border-t bg-background p-4">
			<form onsubmit={handleSubmit} class="flex gap-2">
				<Input
					bind:value={input}
					placeholder="Ask me about algorithms, complexity, or coding patterns..."
					class="flex-1"
					onkeydown={handleKeydown}
					disabled={isLoading}
				/>
				<Button type="submit" size="sm" disabled={!input.trim() || isLoading} class="px-3">
					<Send size={16} />
				</Button>
			</form>
			<div class="mt-2 text-xs text-muted-foreground">
				Press Enter to send, Shift+Enter for new line
			</div>
		</div>
</div>
