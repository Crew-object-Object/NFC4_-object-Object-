import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// GET /api/messages/[roomId] - Get messages for a room
export const GET: RequestHandler = async ({ request, params }) => {
	try {
		const { roomId } = params;
		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session) {
			return json(
				{
					success: false,
					error: 'Unauthorized'
				},
				{ status: 401 }
			);
		}

		// Find the interview by roomId
		const interview = await prisma.interview.findFirst({
			where: { roomId: roomId }
		});

		if (!interview) {
			return json(
				{
					success: false,
					error: 'Interview not found'
				},
				{ status: 404 }
			);
		}

		// Check if user is part of this interview
		const userId = session.user.id;
		if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
			return json(
				{
					success: false,
					error: 'Access denied'
				},
				{ status: 403 }
			);
		}

		// Get messages for this interview
		const messages = await prisma.messages.findMany({
			where: {
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
			},
			orderBy: {
				timestamp: 'asc'
			}
		});

		return json({
			success: true,
			data: messages
		});
	} catch (error) {
		console.error('Error fetching messages:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// POST /api/messages/[roomId] - Send a new message
export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { roomId } = params;
		const body = await request.json();
		const { content } = body;

		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session) {
			return json(
				{
					success: false,
					error: 'Unauthorized'
				},
				{ status: 401 }
			);
		}

		if (!content || content.trim() === '') {
			return json(
				{
					success: false,
					error: 'Message content is required'
				},
				{ status: 400 }
			);
		}

		// Find the interview by roomId
		const interview = await prisma.interview.findFirst({
			where: { roomId: roomId }
		});

		if (!interview) {
			return json(
				{
					success: false,
					error: 'Interview not found'
				},
				{ status: 404 }
			);
		}

		// Check if user is part of this interview
		const userId = session.user.id;
		if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
			return json(
				{
					success: false,
					error: 'Access denied'
				},
				{ status: 403 }
			);
		}

		// Determine the recipient
		const toUserId = interview.interviewerId === userId ? interview.intervieweeId : interview.interviewerId;

		// Create the message
		const message = await prisma.messages.create({
			data: {
				content: content.trim(),
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

		return json({
			success: true,
			data: message
		});
	} catch (error) {
		console.error('Error sending message:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
