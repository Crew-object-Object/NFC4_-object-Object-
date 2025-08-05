import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { addConnection, removeConnection } from '$lib/sse-manager';

export const GET: RequestHandler = async ({ request, url, params }) => {
	const roomId = url.searchParams.get('roomId');
	
	if (!roomId) {
		return new Response('Room ID required', { status: 400 });
	}

	try {
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session) {
			return new Response('Unauthorized', { status: 401 });
		}

		// Verify user has access to this room
		const interview = await prisma.interview.findFirst({
			where: { roomId: roomId }
		});

		if (!interview) {
			return new Response('Interview not found', { status: 404 });
		}

		const userId = session.user.id;
		if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
			return new Response('Access denied', { status: 403 });
		}

		// Create SSE stream
		const stream = new ReadableStream({
			start(controller) {
				// Add connection to room
				const connection = addConnection(roomId, userId, controller);

				// Send initial connection message
				controller.enqueue(`data: ${JSON.stringify({
					type: 'connected',
					roomId
				})}\n\n`);
			},
			cancel() {
				// Remove connection when client disconnects
				removeConnection(roomId, userId);
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Cache-Control'
			}
		});

	} catch (error) {
		console.error('SSE connection error:', error);
		return new Response('Internal server error', { status: 500 });
	}
};
