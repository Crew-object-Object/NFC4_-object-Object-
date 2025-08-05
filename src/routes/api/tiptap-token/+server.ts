import { json } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { auth } from '$lib/auth';
import { TIPTAP_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { roomId } = await request.json();
		
		// Check if user is authenticated
		const session = await auth.api.getSession({
			headers: request.headers
		});
		
		if (!session?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Generate JWT token for TipTap collaboration
		const token = jwt.sign(
			{
				appId: 'jkvv46ek', // Your TipTap app ID
				userId: session.user.id,
				userName: session.user.name || session.user.email,
				roomId: roomId,
				iat: Math.floor(Date.now() / 1000)
			},
			TIPTAP_SECRET || 'fallback-secret-key',
			{ 
				expiresIn: '24h',
				issuer: 'nfc4-interview-app'
			}
		);

		return json({ token });
	} catch (error) {
		console.error('Error generating TipTap token:', error);
		return json({ error: 'Failed to generate token' }, { status: 500 });
	}
};
