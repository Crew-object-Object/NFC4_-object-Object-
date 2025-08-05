export interface SSEMessage {
	type: 'connected' | 'message' | 'error';
	roomId?: string;
	data?: {
		messageId: string;
		content: string;
		timestamp: string;
		from: {
			id: string;
			name: string;
			image?: string;
		};
	};
	error?: string;
}

export interface ChatMessage {
	messageId: string;
	content: string;
	timestamp: string;
	from: {
		id: string;
		name: string;
		image?: string;
	};
}

type MessageHandler = (message: ChatMessage) => void;
type ErrorHandler = (error: string) => void;
type ConnectionHandler = () => void;

export class SSEClient {
	private eventSource: EventSource | null = null;
	private roomId: string | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectInterval = 1000;
	private isConnecting = false;

	private messageHandlers: MessageHandler[] = [];
	private errorHandlers: ErrorHandler[] = [];
	private connectHandlers: ConnectionHandler[] = [];
	private disconnectHandlers: ConnectionHandler[] = [];

	constructor() {
		// Auto-reconnect when window regains focus
		if (typeof window !== 'undefined') {
			window.addEventListener('focus', () => {
				if (this.roomId && (!this.eventSource || this.eventSource.readyState !== EventSource.OPEN)) {
					this.reconnect();
				}
			});
		}
	}

	connect(roomId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.eventSource && this.eventSource.readyState === EventSource.OPEN && this.roomId === roomId) {
				resolve();
				return;
			}

			if (this.isConnecting) {
				setTimeout(() => this.connect(roomId).then(resolve).catch(reject), 100);
				return;
			}

			this.isConnecting = true;
			this.roomId = roomId;

			try {
				// Create SSE connection
				const sseUrl = `/api/sse?roomId=${encodeURIComponent(roomId)}`;
				this.eventSource = new EventSource(sseUrl);

				this.eventSource.onopen = () => {
					console.log('SSE connected');
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					this.connectHandlers.forEach(handler => handler());
					resolve();
				};

				this.eventSource.onmessage = (event) => {
					try {
						const message: SSEMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('Error parsing SSE message:', error);
					}
				};

				this.eventSource.onerror = (error) => {
					console.error('SSE error:', error);
					this.isConnecting = false;
					
					if (this.eventSource?.readyState === EventSource.CLOSED) {
						this.disconnectHandlers.forEach(handler => handler());
						
						// Auto-reconnect if not intentionally closed
						if (this.roomId && this.reconnectAttempts < this.maxReconnectAttempts) {
							setTimeout(() => this.reconnect(), this.reconnectInterval);
						}
					}
					
					this.errorHandlers.forEach(handler => handler('Connection error'));
				};

			} catch (error) {
				this.isConnecting = false;
				reject(error);
			}
		});
	}

	private reconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.roomId) {
			return;
		}

		this.reconnectAttempts++;
		console.log(`Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
		
		setTimeout(() => {
			if (this.roomId) {
				this.connect(this.roomId).catch(() => {
					// Reconnect will be tried again if needed
				});
			}
		}, this.reconnectInterval * this.reconnectAttempts);
	}

	private handleMessage(message: SSEMessage) {
		switch (message.type) {
			case 'connected':
				console.log('SSE connection confirmed for room:', message.roomId);
				break;
			case 'message':
				if (message.data) {
					this.messageHandlers.forEach(handler => handler(message.data!));
				}
				break;
			case 'error':
				if (message.error) {
					this.errorHandlers.forEach(handler => handler(message.error!));
				}
				break;
		}
	}

	async sendMessage(content: string) {
		if (!this.roomId) {
			this.errorHandlers.forEach(handler => handler('Not connected to a room'));
			return;
		}

		try {
			// Send message via HTTP API
			const response = await fetch(`/api/messages/${this.roomId}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					content
				})
			});

			const result = await response.json();

			if (!result.success) {
				console.error('Failed to send message:', result.error);
				this.errorHandlers.forEach(handler => handler(result.error || 'Failed to send message'));
			}
		} catch (error) {
			console.error('Error sending message:', error);
			this.errorHandlers.forEach(handler => handler('Failed to send message'));
		}
	}

	disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.roomId = null;
		this.reconnectAttempts = 0;
	}

	onMessage(handler: MessageHandler) {
		this.messageHandlers.push(handler);
		return () => {
			const index = this.messageHandlers.indexOf(handler);
			if (index > -1) {
				this.messageHandlers.splice(index, 1);
			}
		};
	}

	onError(handler: ErrorHandler) {
		this.errorHandlers.push(handler);
		return () => {
			const index = this.errorHandlers.indexOf(handler);
			if (index > -1) {
				this.errorHandlers.splice(index, 1);
			}
		};
	}

	onConnect(handler: ConnectionHandler) {
		this.connectHandlers.push(handler);
		return () => {
			const index = this.connectHandlers.indexOf(handler);
			if (index > -1) {
				this.connectHandlers.splice(index, 1);
			}
		};
	}

	onDisconnect(handler: ConnectionHandler) {
		this.disconnectHandlers.push(handler);
		return () => {
			const index = this.disconnectHandlers.indexOf(handler);
			if (index > -1) {
				this.disconnectHandlers.splice(index, 1);
			}
		};
	}

	get isConnected(): boolean {
		return this.eventSource?.readyState === EventSource.OPEN;
	}
}

// Singleton instance
export const sseClient = new SSEClient();
