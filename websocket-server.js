#!/usr/bin/env node

import { createServer } from 'http';
import { wsManager } from './src/lib/websocket-server.js';

const server = createServer();
const PORT = process.env.WS_PORT || 3001;

// Initialize WebSocket manager
wsManager.initialize(server);

server.listen(PORT, () => {
	console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('Shutting down WebSocket server...');
	server.close(() => {
		process.exit(0);
	});
});

process.on('SIGTERM', () => {
	console.log('Shutting down WebSocket server...');
	server.close(() => {
		process.exit(0);
	});
});
