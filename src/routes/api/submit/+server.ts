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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { code, language_id, input } = await request.json();

		const data = await submitCode(code, language_id, input);
		const token = data.token;

		console.log(data);

		const output = await fetch(`${JUDGE0_API_URL}/submissions/${token}`, {
			method: 'GET',
			headers: {
				'X-RapidAPI-Key': RAPID_API_KEY!,
				'X-RapidAPI-Host': RAPID_API_URL!
			}
		});

		const result = await output.json();
		return json(result);
	} catch (error) {
		console.error('API Error:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
};
