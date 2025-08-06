import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Simple API endpoint to receive transcript data from client
export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { roomId } = params;
		const transcriptData = await request.json();
		
		console.log('Received transcript data for room:', roomId, {
			entryCount: transcriptData.entries?.length || 0,
			hasFormatted: !!transcriptData.formatted
		});

		// For now, just echo back the data - in a real app you might want to store this in a database
		return json({
			success: true,
			roomId,
			entryCount: transcriptData.entries?.length || 0,
			transcript: transcriptData.formatted || 'No transcript available',
			entries: transcriptData.entries || []
		});
		
	} catch (error) {
		console.error('Error processing transcript data:', error);
		return json({ 
			error: 'Failed to process transcript data',
			transcript: 'Error accessing transcript data'
		}, { status: 500 });
	}
};

// GET endpoint to request transcript (client will need to POST the data)
export const GET: RequestHandler = async ({ params }) => {
	const { roomId } = params;
	
	return json({
		message: 'Please use POST to send transcript data from the client',
		roomId,
		transcript: 'Transcript data must be sent from the browser client',
		entryCount: 0
	});
};
