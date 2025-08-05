import pkg from 'agora-token';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_AGORA_APP_ID, PUBLIC_AGORA_APP_CERTIFICATE } from '$env/static/public';

const { RtcTokenBuilder } = pkg;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { uid, channelName } = await request.json();

		if (!uid || !channelName) {
			return json({ error: 'Missing required parameters' }, { status: 400 });
		}

		const appID = PUBLIC_AGORA_APP_ID;
		const appCertificate = PUBLIC_AGORA_APP_CERTIFICATE;

		if (!appID || !appCertificate) {
			return json({ error: 'Agora credentials not configured' }, { status: 500 });
		}

		// Convert string UID to number if needed
		const numericUid = typeof uid === 'string' ? parseInt(uid.replace(/\D/g, '')) || 0 : uid;

		// Set token expiry time to 24 hours from now
		const expirationTimeInSeconds = 24 * 3600;
		const currentTimestamp = Math.floor(Date.now() / 1000);
		const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

		// Build token with numeric uid and proper role
		const token = RtcTokenBuilder.buildTokenWithUid(
			appID,
			appCertificate,
			channelName,
			numericUid,
			1, // Role: 1 for host, 2 for audience
			privilegeExpiredTs,
			privilegeExpiredTs // Token expiry time
		);

		return json({ token, uid: numericUid });
	} catch (error) {
		console.error('Error generating token:', error);
		return json({ error: 'Failed to generate token' }, { status: 500 });
	}
};
