import type { WebSocketMessage } from './websocket-server';

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

export class WebSocketClient {
	private ws: WebSocket | null = null;
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
				if (this.roomId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
					this.reconnect();
				}
			});
		}
	}

	connect(roomId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN && this.roomId === roomId) {
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
				// Use same host and port as the current page
				const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
				const wsUrl = `${protocol}//${window.location.host}`;
				
				this.ws = new WebSocket(wsUrl);

				this.ws.onopen = () => {
					console.log('WebSocket connected');
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					
					// Join the room
					this.send({
						type: 'join_room',
						roomId
					});

					this.connectHandlers.forEach(handler => handler());
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('Error parsing WebSocket message:', error);
					}
				};

				this.ws.onclose = () => {
					console.log('WebSocket disconnected');
					this.isConnecting = false;
					this.disconnectHandlers.forEach(handler => handler());
					
					// Auto-reconnect if not intentionally closed
					if (this.roomId && this.reconnectAttempts < this.maxReconnectAttempts) {
						setTimeout(() => this.reconnect(), this.reconnectInterval);
					}
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.isConnecting = false;
					this.errorHandlers.forEach(handler => handler('Connection error'));
					reject(new Error('WebSocket connection failed'));
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

	private handleMessage(message: WebSocketMessage) {
		switch (message.type) {
			case 'message':
				if (message.messageId && message.content && message.timestamp && message.from) {
					const chatMessage: ChatMessage = {
						messageId: message.messageId,
						content: message.content,
						timestamp: message.timestamp,
						from: message.from
					};
					this.messageHandlers.forEach(handler => handler(chatMessage));
				}
				break;
			case 'error':
				if (message.error) {
					this.errorHandlers.forEach(handler => handler(message.error!));
				}
				break;
		}
	}

	send(message: Omit<WebSocketMessage, 'timestamp' | 'messageId' | 'from'>) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			this.errorHandlers.forEach(handler => handler('Not connected'));
		}
	}

	sendMessage(content: string) {
		if (!this.roomId) {
			this.errorHandlers.forEach(handler => handler('Not connected to a room'));
			return;
		}

		this.send({
			type: 'message',
			roomId: this.roomId,
			content
		});
	}

	disconnect() {
		if (this.ws) {
			if (this.roomId) {
				this.send({
					type: 'leave_room',
					roomId: this.roomId
				});
			}
			this.ws.close();
			this.ws = null;
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
		return this.ws?.readyState === WebSocket.OPEN;
	}
}

// Singleton instance
export const wsClient = new WebSocketClient();
