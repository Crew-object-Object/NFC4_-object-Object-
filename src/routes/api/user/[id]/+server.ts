import prisma from '$lib/prisma';
import { json } from '@sveltejs/kit';

export async function GET({ params }) {
	const user = await prisma.user.findUnique({
		where: { id: params.id },
		select: { id: true, name: true, image: true }
	});

	if (!user) return json({ error: 'User not found' }, { status: 404 });

	return json(user);
}
