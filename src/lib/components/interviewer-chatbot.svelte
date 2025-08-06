<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Card from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Input } from '$lib/components/ui/input';
	import { Bot, Send, Zap, Clock, Database, MessageSquare, History, HelpCircle } from 'lucide-svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { marked } from 'marked';
	import { VoiceTranscriptionService } from '$lib/voice-transcription';

	interface Props {
		currentCode: string;
		roomId: string;
		isTranscriptionEnabled?: boolean;
	}

	let { currentCode, roomId, isTranscriptionEnabled = false }: Props = $props();

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
		
		console.log('Sending complexity analysis request for room:', roomId);
		await chat.sendMessage({ text: message });
	};

	const getTranscript = async () => {
		// Get transcript directly from localStorage (client-side)
		try {
			const transcriptEntries = VoiceTranscriptionService.getTranscriptHistory(roomId);
			
			console.log('Retrieved transcript for chatbot:', {
				roomId,
				entryCount: transcriptEntries.length
			});

			if (transcriptEntries.length === 0) {
				const message = `The current transcript for room "${roomId}" is empty. No conversation has been recorded yet. This could mean:

1. Voice transcription is not enabled
2. No one has spoken yet
3. The transcription service is not running

Would you like me to help you get started with the interview, or do you have any questions about the code or problem?`;
				
				await chat.sendMessage({ text: message });
			} else {
				// Get only the last transcript entry
				const lastEntry = transcriptEntries[transcriptEntries.length - 1];
				const time = new Date(lastEntry.timestamp).toLocaleTimeString([], { 
					hour: '2-digit', 
					minute: '2-digit',
					second: '2-digit'
				});
				const lastMessage = `[${time}] ${lastEntry.speakerName}: ${lastEntry.text}`;

				const message = `Here is the latest message from the conversation in room "${roomId}":

${lastMessage}

Based on this latest message, I can help you:
1. Analyze what was just discussed
2. Generate follow-up questions
3. Suggest technical challenges
4. Review code patterns mentioned

What would you like to do next?`;

				await chat.sendMessage({ text: message });
			}
		} catch (error) {
			console.error('Error getting transcript:', error);
			await chat.sendMessage({ 
				text: `I encountered an error while retrieving the transcript for room "${roomId}". This might be due to localStorage access issues or the transcript service not being properly initialized.` 
			});
		}
	};

	const generateFollowUps = async () => {
		// Get transcript directly from localStorage (client-side)
		try {
			const transcriptEntries = VoiceTranscriptionService.getTranscriptHistory(roomId);
			
			console.log('Generating follow-ups for room:', roomId, {
				entryCount: transcriptEntries.length,
				hasCode: currentCode.trim().length > 0
			});

			if (transcriptEntries.length === 0) {
				const message = `I don't have any conversation transcript yet for room "${roomId}", so I can't generate specific follow-up questions based on the discussion. 

However, I can suggest some general technical interview questions:

1. **Algorithm Design**: "Can you walk me through your thought process for solving this problem?"
2. **Complexity Analysis**: "What's the time and space complexity of your solution?"
3. **Edge Cases**: "What edge cases should we consider for this solution?"
4. **Optimization**: "How would you optimize this code for better performance?"
5. **Alternative Approaches**: "Can you think of a different way to solve this problem?"

${currentCode.trim() ? 'I can also analyze the current code if you\'d like me to suggest specific questions about it.' : ''}`;
				
				await chat.sendMessage({ text: message });
			} else {
				// Get only the last transcript entry
				const lastEntry = transcriptEntries[transcriptEntries.length - 1];
				const time = new Date(lastEntry.timestamp).toLocaleTimeString([], { 
					hour: '2-digit', 
					minute: '2-digit',
					second: '2-digit'
				});
				const lastMessage = `[${time}] ${lastEntry.speakerName}: ${lastEntry.text}`;

				let message = `Based on the latest message from the conversation:

${lastMessage}

**Suggested Follow-up Questions:**`;

				// Simple analysis to generate relevant questions based on the last message
				const messageText = lastEntry.text.toLowerCase();
				
				if (messageText.includes('algorithm') || messageText.includes('approach')) {
					message += '\n1. "Can you explain the reasoning behind choosing this approach over alternatives?"';
				}
				if (messageText.includes('complexity') || messageText.includes('performance')) {
					message += '\n2. "How would this solution scale with larger inputs?"';
				}
				if (messageText.includes('sort') || messageText.includes('merge') || messageText.includes('quick')) {
					message += '\n3. "What are the trade-offs between different sorting algorithms in this context?"';
				}
				if (currentCode.trim()) {
					message += '\n4. "Can you trace through your code with a specific example?"';
					message += '\n5. "What would happen if we modified the input constraints?"';
				}
				
				message += '\n6. "Are there any edge cases we should test?"';
				message += '\n7. "How would you debug this solution if it wasn\'t working?"';

				await chat.sendMessage({ text: message });
			}
		} catch (error) {
			console.error('Error generating follow-ups:', error);
			await chat.sendMessage({ 
				text: `I encountered an error while accessing the transcript to generate follow-up questions. Let me suggest some general technical interview questions instead.` 
			});
		}
	};

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!input.trim()) return;

		const message = input;
		input = '';

		console.log('Sending chat message for room:', roomId, ':', message);
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
					Analyze Code
				{/if}
			</Button>
			
			{#if isTranscriptionEnabled}
				<Button
					size="sm"
					variant="outline"
					class="gap-2"
					onclick={getTranscript}
					disabled={isLoading}
				>
					<History size={14} />
					Get Transcript
				</Button>
				
				<Button
					size="sm"
					variant="outline"
					class="gap-2"
					onclick={generateFollowUps}
					disabled={isLoading}
				>
					<HelpCircle size={14} />
					Suggest Questions
				</Button>
			{/if}
		</div>
		
		{#if isTranscriptionEnabled}
			<div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
				<MessageSquare size={12} />
				Voice transcription is active - AI has access to conversation history
			</div>
		{/if}
	</div>

	<!-- Chat Messages -->
	<ScrollArea class="flex-1 p-4 max-h-96">
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
							{#if isTranscriptionEnabled}
								<br><br>
								<strong>Voice transcription is active!</strong> I have access to the conversation history
								and can suggest follow-up questions based on what's been discussed.
							{/if}
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
												{:else if part.type === 'tool-getTranscriptHistory'}
													<!-- Display transcript history results -->
													{#if part.state === 'output-available' && part.output}
														{@const transcriptData = part.output as any}
														<Card.Root class="mt-2">
															<Card.Header class="pb-3">
																<Card.Title class="flex items-center gap-2 text-sm">
																	<History size={16} />
																	Conversation Transcript
																</Card.Title>
															</Card.Header>
															<Card.Content class="space-y-4">
																{#if transcriptData.entryCount > 0}
																	<div class="grid grid-cols-2 gap-4 text-xs">
																		<div class="flex items-center justify-between">
																			<span>Total entries:</span>
																			<Badge variant="outline">{transcriptData.entryCount}</Badge>
																		</div>
																		<div class="flex items-center justify-between">
																			<span>Room ID:</span>
																			<Badge variant="outline" class="font-mono">{transcriptData.roomId}</Badge>
																		</div>
																	</div>
																	<div class="max-h-40 overflow-y-auto rounded-md bg-muted p-3">
																		<pre class="whitespace-pre-wrap text-xs font-mono">{transcriptData.transcript}</pre>
																	</div>
																{:else}
																	<p class="text-sm text-muted-foreground">No conversation transcript available yet.</p>
																{/if}
															</Card.Content>
														</Card.Root>
													{/if}
												{:else if part.type === 'tool-generateFollowUpQuestions'}
													<!-- Display follow-up question suggestions -->
													{#if part.state === 'output-available' && part.output}
														{@const questionData = part.output as any}
														<Card.Root class="mt-2">
															<Card.Header class="pb-3">
																<Card.Title class="flex items-center gap-2 text-sm">
																	<HelpCircle size={16} />
																	Suggested Follow-up Questions
																</Card.Title>
															</Card.Header>
															<Card.Content class="space-y-4">
																{#if questionData.suggestions && questionData.suggestions.length > 0}
																	<div class="text-xs text-muted-foreground mb-2">
																		Based on {questionData.transcriptLength} transcript entries
																		{questionData.hasCode ? 'and current code' : ''}
																	</div>
																	<div class="space-y-2">
																		{#each questionData.suggestions as suggestion}
																			<div class="rounded-md bg-muted p-2 text-sm">
																				<div class="flex items-start gap-2">
																					<span class="text-xs text-muted-foreground mt-1">•</span>
																					<span>{suggestion}</span>
																				</div>
																			</div>
																		{/each}
																	</div>
																{:else}
																	<p class="text-sm text-muted-foreground">No follow-up questions generated yet.</p>
																{/if}
															</Card.Content>
														</Card.Root>
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
