import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// GET /api/interviews/[roomId]/problems - Get problems for an interview
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
			where: { roomId: roomId },
			include: {
				problems: {
					include: {
						testCases: true
					}
				}
			}
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

		return json({
			success: true,
			data: interview.problems
		});
	} catch (error) {
		console.error('Error fetching interview problems:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// POST /api/interviews/[roomId]/problems - Add a problem to an interview
export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { roomId } = params;
		const body = await request.json();
		const { title, description, testCases } = body;

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

		if (!title || !description) {
			return json(
				{
					success: false,
					error: 'Title and description are required'
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

		// Check if user is the interviewer
		const userId = session.user.id;
		if (interview.interviewerId !== userId) {
			return json(
				{
					success: false,
					error: 'Only interviewers can add problems'
				},
				{ status: 403 }
			);
		}

		// Create the problem
		const problem = await prisma.problems.create({
			data: {
				title,
				description,
				score: 0, // Default score
				interviewId: interview.id,
				testCases: {
					create: testCases?.map((tc: any) => ({
						input: tc.input,
						output: tc.output
					})) || []
				}
			},
			include: {
				testCases: true
			}
		});

		return json({
			success: true,
			data: problem
		});
	} catch (error) {
		console.error('Error adding problem to interview:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
