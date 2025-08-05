import { problemset } from '$lib/problemset';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// GET /api/problemset - Get all available problems
export const GET: RequestHandler = async () => {
	try {
		return json({
			success: true,
			data: problemset
		});
	} catch (error) {
		console.error('Error fetching problemset:', error);
		return json(
			{
				success: false,
				error: 'Internal server error'
			},
			{ status: 500 }
		);
	}
};
