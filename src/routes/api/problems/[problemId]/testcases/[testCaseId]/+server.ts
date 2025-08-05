import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { broadcastToRoom } from '$lib/sse-manager';

// POST /api/problems/[problemId]/testcases - Add a test case to a problem
export const POST: RequestHandler = async ({ request, params }) => {
	try {
		const { problemId } = params;
		const body = await request.json();
		const { input, output }: { input: string; output: string } = body;

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

		if (!input || !output) {
			return json(
				{
					success: false,
					error: 'Input and output are required'
				},
				{ status: 400 }
			);
		}

		// Find the problem and verify access
		const problem = await prisma.problems.findFirst({
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
				input,
				output,
				problemId: problemId!
			}
		});

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

// DELETE /api/problems/[problemId]/testcases/[testCaseId] - Delete a test case
export const DELETE: RequestHandler = async ({ request, params }) => {
	try {
		const { problemId, testCaseId } = params;

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

		// Find the test case and verify access
		const testCase = await prisma.testCases.findFirst({
			where: {
				testCaseId: testCaseId,
				problemId: problemId
			},
			include: {
				problem: {
					include: {
						interview: true
					}
				}
			}
		});

		if (!testCase) {
			return json(
				{
					success: false,
					error: 'Test case not found'
				},
				{ status: 404 }
			);
		}

		// Check if user is the interviewer
		const userId = session.user.id;
		if (testCase.problem.interview.interviewerId !== userId) {
			return json(
				{
					success: false,
					error: 'Only interviewers can delete test cases'
				},
				{ status: 403 }
			);
		}

		// Delete the test case
		await prisma.testCases.delete({
			where: { testCaseId: testCaseId }
		});

		return json({
			success: true,
			message: 'Test case deleted successfully'
		});
	} catch (error) {
		console.error('Error deleting test case:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
