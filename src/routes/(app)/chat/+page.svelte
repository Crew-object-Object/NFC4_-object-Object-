<script lang="ts">
	import { Avatar } from '$lib/components/ui/avatar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card } from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Chat } from '@ai-sdk/svelte';
	import { Bot, Loader2, Send, User } from '@lucide/svelte';
	import { tick } from 'svelte';
	import { marked } from 'marked';

	// Configure marked for better security and rendering
	marked.setOptions({
		breaks: true,
		gfm: true,
	});

	let input = $state('');
	let messagesContainer: HTMLDivElement;
	const chat = new Chat({});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!input.trim()) return;

		const message = input;
		input = '';

		chat.sendMessage({ text: message });

		// Auto-scroll to bottom after message is sent
		await tick();
		scrollToBottom();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit(event as any);
		}
	}

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

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

	// Create a reactive variable to track loading state using derived
	const isLoading = $derived(
		chat.messages.length > 0 &&
			chat.messages[chat.messages.length - 1]?.role === 'user' &&
			chat.messages.length % 2 === 1
	);

	// Auto-scroll when messages change
	$effect(() => {
		if (chat.messages.length > 0) {
			tick().then(scrollToBottom);
		}
	});
</script>

<main class="flex h-full flex-col">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-2xl font-semibold text-foreground">AI Assistant</h1>
		<p class="text-sm text-muted-foreground">Ask me anything, I'm here to help!</p>
	</div>

	<!-- Chat Messages -->
	<div class="flex-1 overflow-hidden">
		<ScrollArea class="h-full">
			<div class="pr-4" bind:this={messagesContainer}>
				{#if chat.messages.length === 0}
					<div class="flex h-96 items-center justify-center">
						<div class="text-center">
							<div class="mb-4 flex justify-center">
								<div class="rounded-full bg-primary/10 p-4">
									<Bot class="h-8 w-8 text-primary" />
								</div>
							</div>
							<h2 class="mb-2 text-xl font-semibold text-foreground">Welcome to AI Chat</h2>
							<p class="text-muted-foreground">Start a conversation by typing a message below.</p>
						</div>
					</div>
				{:else}
					<div class="space-y-3">
						{#each chat.messages as message, messageIndex}
							<div class="flex gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
								{#if message.role === 'assistant'}
									<Avatar class="h-8 w-8 shrink-0">
										<div class="flex h-full w-full items-center justify-center bg-primary">
											<Bot class="h-4 w-4 text-primary-foreground" />
										</div>
									</Avatar>
								{/if}

								<Card
									class="max-w-[80%] py-0 transition-all hover:shadow-md {message.role === 'user'
										? 'bg-primary text-primary-foreground hover:bg-primary/90'
										: 'bg-card hover:bg-muted/50'}"
								>
									<div class="px-4 py-2">
										{#each message.parts as part, partIndex}
											{#if part.type === 'text'}
												<div
													class="prose prose-sm max-w-none {message.role === 'user'
														? 'prose-invert [&_*]:text-primary-foreground [&_code]:text-primary-foreground [&_pre]:bg-primary-foreground/10 [&_pre_code]:text-primary-foreground'
														: 'prose-neutral dark:prose-invert [&_pre]:bg-muted [&_code]:bg-muted [&_code]:text-foreground'} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:rounded-md [&_pre]:p-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre_code]:p-0 [&_pre_code]:bg-transparent"
												>
													{@html renderMarkdown(part.text)}
												</div>
											{/if}
										{/each}
										<div
											class="mt-1 text-xs opacity-70 {message.role === 'user'
												? 'text-primary-foreground/70'
												: 'text-muted-foreground'}"
										>
											{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
										</div>
									</div>
								</Card>

								{#if message.role === 'user'}
									<Avatar class="h-8 w-8 shrink-0">
										<div class="flex h-full w-full items-center justify-center bg-muted">
											<User class="h-4 w-4 text-muted-foreground" />
										</div>
									</Avatar>
								{/if}
							</div>
						{/each}

						{#if isLoading}
							<div class="flex gap-3">
								<Avatar class="h-8 w-8 shrink-0">
									<div class="flex h-full w-full items-center justify-center bg-primary">
										<Bot class="h-4 w-4 text-primary-foreground" />
									</div>
								</Avatar>
								<Card class="max-w-[80%] bg-card">
									<div class="flex items-center gap-2 px-4 py-2">
										<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
										<span class="text-sm text-muted-foreground">AI is thinking...</span>
									</div>
								</Card>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</ScrollArea>
	</div>

	<!-- Input Area -->
	<div class="mt-6 border-t bg-background pt-4">
		<form onsubmit={handleSubmit} class="flex gap-2">
			<div class="relative flex-1">
				<Input
					bind:value={input}
					placeholder="Type your message here... (Press Enter to send)"
					class="resize-none pr-12"
					disabled={isLoading}
					onkeydown={handleKeydown}
				/>
			</div>
			<Button
				type="submit"
				size="icon"
				disabled={!input.trim() || isLoading}
				class="h-9 w-9 shrink-0 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
			>
				{#if isLoading}
					<Loader2 class="h-4 w-4 animate-spin" />
				{:else}
					<Send class="h-4 w-4" />
				{/if}
				<span class="sr-only">Send message</span>
			</Button>
		</form>
		<p class="mt-2 text-center text-xs text-muted-foreground">
			Press Enter to send, Shift+Enter for new line
		</p>
	</div>
</main>
