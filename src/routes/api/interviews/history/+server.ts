import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
	try {
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

		const userId = session.user.id;
		console.log('Fetching interviews for user:', userId);

		// First, let's check if there are any interviews at all for this user
		const allInterviews = await prisma.interview.findMany({
			where: {
				OR: [
					{ interviewerId: userId },
					{ intervieweeId: userId }
				]
			},
			select: {
				id: true,
				status: true,
				startTime: true,
				endTime: true,
				interviewTitle: true
			}
		});

		console.log(`Total interviews found for user ${userId}:`, allInterviews.length);
		console.log('Interview statuses:', allInterviews.map(i => ({ id: i.id, status: i.status, title: i.interviewTitle })));

		const interviews = await prisma.interview.findMany({
			where: {
				OR: [
					{ interviewerId: userId },
					{ intervieweeId: userId }
				],
				status: 'COMPLETED'
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
				},
				problems: {
					select: {
						id: true,
						title: true,
						description: true,
						score: true,
						testCases: {
							select: {
								testCaseId: true,
								input: true,
								output: true
							}
						}
					}
				}
			},
			orderBy: {
				endTime: 'desc'
			}
		});

		console.log(`Found ${interviews.length} completed interviews for user ${userId}`);

		return json({
			success: true,
			data: interviews
		});
	} catch (error) {
		console.error('Error fetching interview history:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
