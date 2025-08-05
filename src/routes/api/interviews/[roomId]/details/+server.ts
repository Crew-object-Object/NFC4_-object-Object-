import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	try {
		const { roomId } = params;
		
		if (!roomId) {
			return json({ success: false, error: 'Room ID is required' }, { status: 400 });
		}

		const session = await auth.api.getSession({
			headers: request.headers
		});

		if (!session) {
			return json({ success: false, error: 'Unauthorized' }, { status: 401 });
		}

		const interview = await prisma.interview.findFirst({
			where: {
				roomId: roomId
			},
			include: {
				interviewer: {
					select: {
						id: true,
						name: true,
						email: true
					}
				},
				interviewee: {
					select: {
						id: true,
						name: true,
						email: true
					}
				}
			}
		});

		if (!interview) {
			return json({ success: false, error: 'Interview not found' }, { status: 404 });
		}

		// Check if user is part of this interview
		const userId = session.user.id;
		if (interview.interviewerId !== userId && interview.intervieweeId !== userId) {
			return json({ success: false, error: 'Access denied' }, { status: 403 });
		}

		return json({
			success: true,
			data: interview
		});
	} catch (error) {
		console.error('Error fetching interview details:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch interview details'
			},
			{ status: 500 }
		);
	}
};
