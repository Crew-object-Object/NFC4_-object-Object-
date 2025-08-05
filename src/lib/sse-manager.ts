// Store active connections by room
const connections = new Map<string, Set<{ 
	controller: ReadableStreamDefaultController; 
	userId: string; 
	roomId: string;
}>>();

export function addConnection(roomId: string, userId: string, controller: ReadableStreamDefaultController) {
	if (!connections.has(roomId)) {
		connections.set(roomId, new Set());
	}
	
	const connection = { controller, userId, roomId };
	connections.get(roomId)!.add(connection);
	
	console.log(`User ${userId} connected to room ${roomId} via SSE`);
	return connection;
}

export function removeConnection(roomId: string, userId: string) {
	const roomConnections = connections.get(roomId);
	if (roomConnections) {
		for (const conn of roomConnections) {
			if (conn.userId === userId) {
				roomConnections.delete(conn);
				break;
			}
		}
		if (roomConnections.size === 0) {
			connections.delete(roomId);
		}
	}
	console.log(`User ${userId} disconnected from room ${roomId}`);
}

// Function to broadcast message to all connections in a room
export function broadcastToRoom(roomId: string, message: any) {
	const roomConnections = connections.get(roomId);
	if (roomConnections) {
		const messageData = `data: ${JSON.stringify(message)}\n\n`;
		
		// Send to all connections, removing any that are closed
		const toRemove: any[] = [];
		for (const connection of roomConnections) {
			try {
				connection.controller.enqueue(messageData);
			} catch (error) {
				// Connection is closed, mark for removal
				toRemove.push(connection);
			}
		}
		
		// Clean up closed connections
		toRemove.forEach(conn => roomConnections.delete(conn));
		
		if (roomConnections.size === 0) {
			connections.delete(roomId);
		}
	}
}
