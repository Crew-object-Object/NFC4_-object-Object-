import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const RAPID_API_KEY = process.env.RAPID_API_KEY;
const RAPID_API_URL = process.env.RAPID_API_HOST;
const JUDGE0_API_URL = process.env.JUDGE0_API_URL;

async function submitCode(code: string, language_id: string, input: string) {
	const response = await fetch(`${JUDGE0_API_URL}/submissions`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'X-RapidAPI-Key': RAPID_API_KEY!,
			'X-RapidAPI-Host': RAPID_API_URL!
		},
		body: JSON.stringify({
			source_code: code,
			language_id,
			stdin: input
		})
	});

	return response.json();
}

async function waitForExecution(token: string, maxRetries: number = 30): Promise<any> {
	for (let i = 0; i < maxRetries; i++) {
		// wait for 1 seconds
		await new Promise(resolve => setTimeout(resolve, 1000));

		const response = await fetch(`${JUDGE0_API_URL}/submissions/${token}`, {
			method: 'GET',
			headers: {
				'X-RapidAPI-Key': RAPID_API_KEY!,
				'X-RapidAPI-Host': RAPID_API_URL!
			}
		});

		const result = await response.json();
		console.log(result)
		
		// Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded, etc.
		// Wait if still processing (status 1 or 2)
		if (result.status?.id === 1 || result.status?.id === 2) {
			// Wait 1 second before retrying
			await new Promise(resolve => setTimeout(resolve, 1000));
			continue;
		}
		
		// Execution completed (success or error)
		return result;
	}
	
	// Timeout after max retries
	throw new Error('Execution timeout - took too long to complete');
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { code, language_id, input } = await request.json();

		const data = await submitCode(code, language_id, input);
		const token = data.token;

		if (!token) {
			return json({ error: 'Failed to submit code - no token received' }, { status: 400 });
		}

		console.log('Submission token:', token);

		// Wait for execution to complete
		const result = await waitForExecution(token);
		
		console.log('Execution result:', result);
		return json(result);
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
};
