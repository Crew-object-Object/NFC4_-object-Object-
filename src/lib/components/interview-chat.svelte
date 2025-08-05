<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { sseClient, type ChatMessage } from '$lib/sse-client';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import SendIcon from '@lucide/svelte/icons/send';

	export let roomId: string;

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

	// Chat state
	let messages: Message[] = [];
	let newMessage = '';
	let chatContainer: HTMLDivElement;
	let isLoading = false;
	let sseConnected = false;
	let connectionError = '';

	// Initialize SSE connection
	const initializeSSE = async () => {
		if (!roomId) return;

		try {
			await sseClient.connect(roomId);
			sseConnected = true;
			connectionError = '';
			
			// Load initial messages
			await fetchMessages();
		} catch (error) {
			console.error('Failed to connect SSE:', error);
			connectionError = 'Failed to connect to chat';
			sseConnected = false;
		}
	};

	// Fetch initial messages from API (for when page loads)
	const fetchMessages = async () => {
		if (!roomId) return;

		try {
			const response = await fetch(`/api/messages/${roomId}`);
			const result = await response.json();

			if (result.success) {
				messages = result.data;
				setTimeout(scrollToBottom, 100);
			} else {
				console.error('Failed to fetch messages:', result.error);
			}
		} catch (error) {
			console.error('Error fetching messages:', error);
		}
	};

	// Send a new message
	const sendMessage = async () => {
		if (!newMessage.trim() || isLoading || !roomId || !sseConnected) return;

		const messageContent = newMessage.trim();
		newMessage = '';
		isLoading = true;

		try {
			// Send via SSE client
			await sseClient.sendMessage(messageContent);
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

	// SSE event handlers
	const handleNewMessage = (message: ChatMessage) => {
		// Add new message to the list
		messages = [...messages, message];
		setTimeout(scrollToBottom, 100);
	};

	const handleSSEError = (error: string) => {
		console.error('SSE error:', error);
		connectionError = error;
		sseConnected = false;
	};

	const handleSSEConnect = () => {
		sseConnected = true;
		connectionError = '';
		console.log('SSE connected');
	};

	const handleSSEDisconnect = () => {
		sseConnected = false;
		console.log('SSE disconnected');
	};

	onMount(() => {
		if (roomId) {
			// Initialize SSE connection
			initializeSSE();
			
			// Set up event handlers
			const unsubscribeMessage = sseClient.onMessage(handleNewMessage);
			const unsubscribeError = sseClient.onError(handleSSEError);
			const unsubscribeConnect = sseClient.onConnect(handleSSEConnect);
			const unsubscribeDisconnect = sseClient.onDisconnect(handleSSEDisconnect);
			
			// Cleanup function
			return () => {
				unsubscribeMessage();
				unsubscribeError();
				unsubscribeConnect();
				unsubscribeDisconnect();
			};
		}
	});

	onDestroy(() => {
		sseClient.disconnect();
	});
</script>

<!-- Chat Section -->
<div class="flex h-full flex-col bg-background">
	<div class="flex items-center gap-2 border-b px-4 py-2">
		<MessageCircleIcon size={16} />
		<h3 class="text-sm font-medium">Chat</h3>
		<span class="text-xs text-muted-foreground">({messages.length})</span>
		
		<!-- Connection Status -->
		<div class="ml-auto flex items-center gap-2">
			{#if sseConnected}
				<div class="flex items-center gap-1">
					<div class="h-2 w-2 rounded-full bg-green-500"></div>
					<span class="text-xs text-green-600">Connected</span>
				</div>
			{:else}
				<div class="flex items-center gap-1">
					<div class="h-2 w-2 rounded-full bg-red-500"></div>
					<span class="text-xs text-red-600">
						{connectionError || 'Disconnected'}
					</span>
				</div>
			{/if}
		</div>
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
				placeholder={sseConnected ? "Type a message..." : "Connecting..."}
				class="flex-1 rounded-md border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-50"
				bind:value={newMessage}
				onkeypress={handleKeyPress}
				disabled={isLoading || !sseConnected}
			/>
			<button
				type="submit"
				class="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isLoading || !newMessage.trim() || !sseConnected}
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
