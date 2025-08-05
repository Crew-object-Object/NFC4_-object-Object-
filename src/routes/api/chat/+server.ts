import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type UIMessage, convertToModelMessages } from 'ai';

import { OPENROUTER_API_KEY } from '$env/static/private';

const openrouter = createOpenRouter({
	apiKey: OPENROUTER_API_KEY
});

export async function POST({ request }) {
	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: openrouter('google/gemma-3-12b-it:free'),
		messages: convertToModelMessages(messages)
	});

	return result.toUIMessageStreamResponse();
}
