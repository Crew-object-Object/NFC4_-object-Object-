import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { auth } from '$lib/auth';
import prisma from '$lib/prisma';

export interface WebSocketMessage {
	type: 'message' | 'join_room' | 'leave_room' | 'error';
	roomId?: string;
	content?: string;
	messageId?: string;
	timestamp?: string;
	from?: {
		id: string;
		name: string;
		image?: string;
	};
	error?: string;
}

class WebSocketManager {
	private wss: WebSocketServer | null = null;
	private roomConnections = new Map<string, Set<any>>(); // roomId -> Set of WebSockets
	private userConnections = new Map<string, any>(); // userId -> WebSocket

	initialize(server: any) {
		this.wss = new WebSocketServer({ server });

		this.wss.on('connection', async (ws: any, request: IncomingMessage) => {
			console.log('New WebSocket connection');

			ws.on('message', async (data: Buffer) => {
				try {
					const message: WebSocketMessage = JSON.parse(data.toString());
					await this.handleMessage(ws, message, request);
				} catch (error) {
					console.error('Error parsing WebSocket message:', error);
					this.sendError(ws, 'Invalid message format');
				}
			});

			ws.on('close', () => {
				this.handleDisconnection(ws);
			});

			ws.on('error', (error: Error) => {
				console.error('WebSocket error:', error);
			});
		});
	}

	private async handleMessage(ws: any, message: WebSocketMessage, request: IncomingMessage) {
		switch (message.type) {
			case 'join_room':
				await this.handleJoinRoom(ws, message, request);
				break;
			case 'message':
				await this.handleChatMessage(ws, message, request);
				break;
			case 'leave_room':
				this.handleLeaveRoom(ws, message);
				break;
			default:
				this.sendError(ws, 'Unknown message type');
		}
	}

	private async handleJoinRoom(ws: any, message: WebSocketMessage, request: IncomingMessage) {
		if (!message.roomId) {
			this.sendError(ws, 'Room ID is required');
			return;
		}

		try {
			// Get session from cookies
			const headers = new Headers();
			if (request.headers.cookie) {
				headers.set('cookie', request.headers.cookie);
			}
			const session = await auth.api.getSession({
				headers
			});

			if (!session) {
				this.sendError(ws, 'Unauthorized');
				return;
			}

			// Verify user has access to this room
			const interview = await prisma.interview.findFirst({
				where: { roomId: message.roomId }
			});

			if (!interview) {
				this.sendError(ws, 'Interview not found');
				return;
			}

			const userId = session.user.id;
			if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
				this.sendError(ws, 'Access denied');
				return;
			}

			// Add to room connections
			if (!this.roomConnections.has(message.roomId)) {
				this.roomConnections.set(message.roomId, new Set());
			}
			this.roomConnections.get(message.roomId)!.add(ws);

			// Store user connection
			this.userConnections.set(userId, ws);
			ws.roomId = message.roomId;
			ws.userId = userId;

			console.log(`User ${userId} joined room ${message.roomId}`);
		} catch (error) {
			console.error('Error handling join room:', error);
			this.sendError(ws, 'Internal server error');
		}
	}

	private async handleChatMessage(ws: any, message: WebSocketMessage, request: IncomingMessage) {
		if (!message.content || !message.roomId) {
			this.sendError(ws, 'Content and room ID are required');
			return;
		}

		try {
			// Get session
			const headers = new Headers();
			if (request.headers.cookie) {
				headers.set('cookie', request.headers.cookie);
			}
			const session = await auth.api.getSession({
				headers
			});

			if (!session) {
				this.sendError(ws, 'Unauthorized');
				return;
			}

			// Find the interview
			const interview = await prisma.interview.findFirst({
				where: { roomId: message.roomId }
			});

			if (!interview) {
				this.sendError(ws, 'Interview not found');
				return;
			}

			const userId = session.user.id;
			if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
				this.sendError(ws, 'Access denied');
				return;
			}

			// Determine the recipient
			const toUserId = interview.interviewerId === userId ? interview.intervieweeId : interview.interviewerId;

			// Create the message in database
			const savedMessage = await prisma.messages.create({
				data: {
					content: message.content.trim(),
					fromUserId: userId,
					toUserId: toUserId,
					interviewId: interview.id
				},
				include: {
					from: {
						select: {
							id: true,
							name: true,
							image: true
						}
					}
				}
			});

			// Broadcast to all clients in the room
			const responseMessage: WebSocketMessage = {
				type: 'message',
				roomId: message.roomId,
				messageId: savedMessage.messageId,
				content: savedMessage.content,
				timestamp: savedMessage.timestamp.toISOString(),
				from: {
					id: savedMessage.from.id,
					name: savedMessage.from.name,
					image: savedMessage.from.image || undefined
				}
			};

			this.broadcastToRoom(message.roomId, responseMessage);

		} catch (error) {
			console.error('Error handling chat message:', error);
			this.sendError(ws, 'Failed to send message');
		}
	}

	private handleLeaveRoom(ws: any, message: WebSocketMessage) {
		if (ws.roomId) {
			const roomConnections = this.roomConnections.get(ws.roomId);
			if (roomConnections) {
				roomConnections.delete(ws);
				if (roomConnections.size === 0) {
					this.roomConnections.delete(ws.roomId);
				}
			}
		}

		if (ws.userId) {
			this.userConnections.delete(ws.userId);
		}

		console.log(`User ${ws.userId} left room ${ws.roomId}`);
	}

	private handleDisconnection(ws: any) {
		this.handleLeaveRoom(ws, { type: 'leave_room' });
	}

	private broadcastToRoom(roomId: string, message: WebSocketMessage) {
		const connections = this.roomConnections.get(roomId);
		if (connections) {
			const messageData = JSON.stringify(message);
			connections.forEach((ws) => {
				if (ws.readyState === 1) { // WebSocket.OPEN
					ws.send(messageData);
				}
			});
		}
	}

	private sendError(ws: any, error: string) {
		const message: WebSocketMessage = {
			type: 'error',
			error
		};
		ws.send(JSON.stringify(message));
	}
}

export const wsManager = new WebSocketManager();
