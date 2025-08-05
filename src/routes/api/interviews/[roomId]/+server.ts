import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ request, params }) => {
	try {
		const { roomId } = params;
		const { status, interviewScore } = await request.json();

		if (!roomId) {
			return json({ success: false, error: 'Room ID is required' }, { status: 400 });
		}

		if (!status || !['PENDING', 'COMPLETED'].includes(status)) {
			return json(
				{ success: false, error: 'Valid status is required (PENDING or COMPLETED)' },
				{ status: 400 }
			);
		}

		// Validate interview score if provided
		if (interviewScore !== undefined) {
			const score = parseInt(interviewScore);
			if (isNaN(score) || score < 0 || score > 100) {
				return json(
					{ success: false, error: 'Interview score must be a number between 0-100' },
					{ status: 400 }
				);
			}
		}

		const interview = await prisma.interview.findFirst({
			where: {
				roomId: roomId
			}
		});

		if (!interview) {
			return json({ success: false, error: 'Interview not found' }, { status: 404 });
		}

		// Prepare update data
		const updateData: any = {
			status: status
		};

		// Add interview score if provided
		if (interviewScore !== undefined) {
			updateData.interviewScore = parseInt(interviewScore);
		}

		// Set end time if completing the interview
		if (status === 'COMPLETED' && !interview.endTime) {
			updateData.endTime = new Date();
		}

		const updatedInterview = await prisma.interview.update({
			where: {
				id: interview.id
			},
			data: updateData,
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

		return json({
			success: true,
			data: updatedInterview
		});
	} catch (error) {
		console.error('Error updating interview status:', error);
		return json(
			{
				success: false,
				error: 'Failed to update interview status'
			},
			{ status: 500 }
		);
	}
};
