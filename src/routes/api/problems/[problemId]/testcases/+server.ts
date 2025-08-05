import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { broadcastToRoom } from '$lib/sse-manager';

export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { problemId } = params;
		const body = await request.json();
		const { input, output } = body;

		// Validate problemId
		if (!problemId) {
			return json(
				{
					success: false,
					error: 'Problem ID is required'
				},
				{ status: 400 }
			);
		}

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

		// Validate required fields
		if (!input || !output) {
			return json(
				{
					success: false,
					error: 'Input and output are required'
				},
				{ status: 400 }
			);
		}

		// Find the problem and verify user permissions
		const problem = await prisma.problems.findUnique({
			where: { id: problemId },
			include: {
				interview: true
			}
		});

		if (!problem) {
			return json(
				{
					success: false,
					error: 'Problem not found'
				},
				{ status: 404 }
			);
		}

		// Check if user is the interviewer
		const userId = session.user.id;
		if (problem.interview.interviewerId !== userId) {
			return json(
				{
					success: false,
					error: 'Only interviewers can add test cases'
				},
				{ status: 403 }
			);
		}

		// Create the test case
		const testCase = await prisma.testCases.create({
			data: {
				input: input.trim(),
				output: output.trim(),
				problemId: problemId
			}
		});

		// Broadcast to SSE clients
		const roomId = problem.interview.roomId;
		if (roomId) {
			broadcastToRoom(roomId, {
				type: 'testCaseAdded',
				data: {
					problemId: problemId,
					testCase: {
						testCaseId: testCase.testCaseId,
						input: testCase.input,
						output: testCase.output
					}
				}
			});
		}

		return json({
			success: true,
			data: testCase
		});
	} catch (error) {
		console.error('Error adding test case:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
