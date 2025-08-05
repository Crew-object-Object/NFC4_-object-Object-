import { json } from '@sveltejs/kit';
import prisma  from '$lib/prisma';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { problemId } = params;
		const { totalTestCases, passedTestCases } = await request.json();

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

		if (typeof totalTestCases !== 'number' || typeof passedTestCases !== 'number' || 
			totalTestCases <= 0 || passedTestCases < 0 || passedTestCases > totalTestCases) {
			return json(
				{
					success: false,
					error: 'Valid test case counts are required'
				},
				{ status: 400 }
			);
		}

		// Calculate percentage score
		const percentageScore = Math.round((passedTestCases / totalTestCases) * 100);

		// Get current problem to check existing score
		const currentProblem = await prisma.problems.findUnique({
			where: {
				id: problemId
			}
		});

		if (!currentProblem) {
			return json(
				{
					success: false,
					error: 'Problem not found'
				},
				{ status: 404 }
			);
		}

		// Only update if new score is higher than current score
		let updatedProblem = currentProblem;
		if (percentageScore > currentProblem.score) {
			updatedProblem = await prisma.problems.update({
				where: {
					id: problemId
				},
				data: {
					score: percentageScore
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

			console.log(`Problem score updated for problem ${problemId}: ${passedTestCases}/${totalTestCases} test cases passed (new max score: ${percentageScore}%, previous: ${currentProblem.score}%)`);
		} else {
			console.log(`Problem score not updated for problem ${problemId}: ${passedTestCases}/${totalTestCases} test cases passed (score: ${percentageScore}%, current max: ${currentProblem.score}%)`);
		}

		return json({
			success: true,
			data: {
				problemId: updatedProblem.id,
				title: updatedProblem.title,
				score: updatedProblem.score,
				passedTestCases,
				totalTestCases,
				percentageScore,
				isNewMaxScore: percentageScore > currentProblem.score
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
