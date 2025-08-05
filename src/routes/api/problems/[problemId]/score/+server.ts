import { json } from '@sveltejs/kit';
import prisma  from '$lib/prisma';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { problemId } = params;
		const { score, totalTestCases, passedTestCases } = await request.json();

		// Validate input
		if (!problemId) {
			return json(
				{
					success: false,
					error: 'Problem ID is required'
				},
				{ status: 400 }
			);
		}

		if (typeof score !== 'number' || score < 0) {
			return json(
				{
					success: false,
					error: 'Valid score is required'
				},
				{ status: 400 }
			);
		}

		// Update the problem score in the database
		const updatedProblem = await prisma.problems.update({
			where: {
				id: problemId
			},
			data: {
				score: score
			},
			include: {
				testCases: true,
				interview: {
					include: {
						interviewer: true,
						interviewee: true
					}
				}
			}
		});

		console.log(`Problem score updated for problem ${problemId}: ${passedTestCases}/${totalTestCases} test cases passed (score: ${score})`);

		return json({
			success: true,
			data: {
				problemId: updatedProblem.id,
				title: updatedProblem.title,
				score: updatedProblem.score,
				passedTestCases,
				totalTestCases
			}
		});
	} catch (error) {
		console.error('Error updating problem score:', error);
		return json(
			{
				success: false,
				error: 'Failed to update problem score'
			},
			{ status: 500 }
		);
	}
};
