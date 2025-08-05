import prisma from '$lib/prisma';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	const data = await prisma.user.findMany({
		where: {
			role: 'Interviewee'
		}
	});
	return json({
		success: true,
		data
	});
};
