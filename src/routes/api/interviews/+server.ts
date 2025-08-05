import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { intervieweeId, startTime, endTime, interviewTitle, interviewDescription } = body;

		const session = await auth.api.getSession({
			headers: request.headers
		});
		// Validate required fields
		if (!intervieweeId || !startTime || !endTime || !interviewTitle || !interviewDescription) {
			return json(
				{
					success: false,
					error: 'Missing required fields'
				},
				{ status: 400 }
			);
		}

		// Validate that interviewee exists and has the correct role
		const interviewee = await prisma.user.findUnique({
			where: { id: intervieweeId }
		});

		if (!interviewee) {
			return json(
				{
					success: false,
					error: 'Interviewee not found'
				},
				{ status: 404 }
			);
		}

		if (interviewee.role !== 'Interviewee') {
			return json(
				{
					success: false,
					error: 'Selected user is not an interviewee'
				},
				{ status: 400 }
			);
		}

		// Validate datetime format and logic
		const startDateTime = new Date(startTime);
		const endDateTime = new Date(endTime);

		if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
			return json(
				{
					success: false,
					error: 'Invalid date format'
				},
				{ status: 400 }
			);
		}

		if (endDateTime <= startDateTime) {
			return json(
				{
					success: false,
					error: 'End time must be after start time'
				},
				{ status: 400 }
			);
		}

		if (startDateTime <= new Date()) {
			return json(
				{
					success: false,
					error: 'Start time must be in the future'
				},
				{ status: 400 }
			);
		}

		// Check for scheduling conflicts
		const conflictingInterview = await prisma.interview.findFirst({
			where: {
				intervieweeId,
				OR: [
					{
						AND: [{ startTime: { lte: startDateTime } }, { endTime: { gt: startDateTime } }]
					},
					{
						AND: [{ startTime: { lt: endDateTime } }, { endTime: { gte: endDateTime } }]
					},
					{
						AND: [{ startTime: { gte: startDateTime } }, { endTime: { lte: endDateTime } }]
					}
				]
			}
		});

		if (conflictingInterview) {
			return json(
				{
					success: false,
					error: 'Interviewee has a conflicting interview scheduled'
				},
				{ status: 409 }
			);
		}

		// Create the interview
		const interview = await prisma.interview.create({
			data: {
				intervieweeId,
				interviewerId: session?.user.id,
				startTime: startDateTime,
				endTime: endDateTime,
				interviewTitle: interviewTitle.trim(),
				interviewDescription: interviewDescription.trim(),
				status: 'PENDING',
				interviewScore: 0
			},
			include: {
				interviewee: {
					select: {
						id: true,
						name: true,
						email: true
					}
				}
			}
		});

		return json({
			success: true,
			data: interview,
			message: 'Interview scheduled successfully'
		});
	} catch (error) {
		console.error('Error creating interview:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
