import { auth } from '$lib/auth';
import prisma from '$lib/prisma';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage, tool } from 'ai';
import { z } from 'zod';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const lmstudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: 'http://192.168.56.1:1234/v1',
});

async function fetchInterviews(userId: string) {
	return await prisma.interview.findMany({
		where: {
			OR: [{ interviewerId: userId }, { intervieweeId: userId }]
		},
		include: {
			interviewer: { select: { id: true, name: true, email: true } },
			interviewee: { select: { id: true, name: true, email: true } },
			problems: { select: { id: true, title: true, score: true } }
		},
		orderBy: { startTime: 'desc' }
	});
}

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { messages }: { messages: UIMessage[] } = await request.json();

	const result = streamText({
		model: lmstudio('qwen/qwen3-4b'),
		messages: convertToModelMessages(messages),
		stopWhen: stepCountIs(5),
		tools: {
			fetchInterviews: tool({
				description: 'Fetch all interviews for the current user (both as interviewer and interviewee)',
				inputSchema: z.object({}),
				execute: async () => {
					const interviews = await fetchInterviews(session.user.id);
					return { interviews };
				}
			})
		}
	});

	return result.toUIMessageStreamResponse();
}
