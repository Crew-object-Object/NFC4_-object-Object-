import { auth } from '$lib/auth';
import { createInterview, fetchInterviews, getAllUsers, updateInterview } from '$lib/interview-db';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';

const lmstudio = createOpenAICompatible({
	name: 'lmstudio',
	baseURL: 'http://192.168.56.1:1234/v1'
});

export async function POST({ request }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { messages }: { messages: UIMessage[] } = await request.json();

	console.log(messages)

	const result = streamText({
		model: lmstudio('google/gemma-3-12b'),
		messages: convertToModelMessages(messages ?? []),
		stopWhen: stepCountIs(10),
		tools: {
			fetchInterviews: tool({
				description:
					'Fetch all interviews for the current user (both as interviewer and interviewee)',
				inputSchema: z.object({}),
				execute: async () => {
					const interviews = await fetchInterviews(session.user.id);
					return { interviews };
				}
			}),
			createInterview: tool({
				description: 'Create/schedule a new interview',
				inputSchema: z.object({
					intervieweeId: z.string().describe('ID of the user who will be interviewed'),
					startTime: z.string().describe('Start time of the interview (ISO date string)'),
					endTime: z.string().describe('End time of the interview (ISO date string)'),
					interviewTitle: z.string().describe('Title of the interview'),
					interviewDescription: z.string().describe('Description of the interview'),
					problems: z
						.array(
							z.object({
								title: z.string().describe('Title of the problem'),
								description: z.string().optional().describe('Description of the problem'),
								score: z.number().describe('Score/points for this problem')
							})
						)
						.optional()
						.describe('Optional array of problems to include in the interview')
				}),
				execute: async ({
					intervieweeId,
					startTime,
					endTime,
					interviewTitle,
					interviewDescription,
					problems
				}) => {
					const interview = await createInterview(session.user.id, {
						intervieweeId,
						startTime: new Date(startTime),
						endTime: new Date(endTime),
						interviewTitle,
						interviewDescription,
						problems
					});
					return { interview };
				}
			}),
			updateInterview: tool({
				description:
					'Update an existing interview (modify details, reschedule, change status, etc.)',
				inputSchema: z.object({
					interviewId: z.string().describe('ID of the interview to update'),
					intervieweeId: z
						.string()
						.optional()
						.describe('New interviewee ID (if changing the interviewee)'),
					startTime: z.string().optional().describe('New start time (ISO date string)'),
					endTime: z.string().optional().describe('New end time (ISO date string)'),
					status: z
						.enum(['PENDING', 'COMPLETED'])
						.optional()
						.describe('New status of the interview'),
					interviewTitle: z.string().optional().describe('New title of the interview'),
					interviewDescription: z.string().optional().describe('New description of the interview'),
					interviewScore: z
						.number()
						.optional()
						.describe('Final score of the interview (usually set after completion)')
				}),
				execute: async ({
					interviewId,
					intervieweeId,
					startTime,
					endTime,
					status,
					interviewTitle,
					interviewDescription,
					interviewScore
				}) => {
					const interview = await updateInterview(interviewId, {
						...(intervieweeId && { intervieweeId }),
						...(startTime && { startTime: new Date(startTime) }),
						...(endTime && { endTime: new Date(endTime) }),
						...(status && { status }),
						...(interviewTitle && { interviewTitle }),
						...(interviewDescription && { interviewDescription }),
						...(interviewScore !== undefined && { interviewScore })
					});
					return { interview };
				}
			}),
			getAllUsers: tool({
				description: 'Get a list of all users in the system (for selecting interviewees)',
				inputSchema: z.object({}),
				execute: async () => {
					const users = await getAllUsers();
					return { users };
				}
			}),
			analyzeComplexity: tool({
				description: 'Analyze the time and space complexity of code',
				inputSchema: z.object({
					code: z.string().describe('The code to analyze for complexity'),
					input: z
						.string()
						.optional()
						.describe('Optional input data for the code analysis via stdin')
				}),
				execute: async ({ code, input }) => {
					// Define complexity enums
					const complexityOptions = [
						'O(1)',
						'O(log n)',
						'O(n)',
						'O(n log n)',
						'O(n^2)',
						'O(n^3)',
						'O(2^n)',
						'O(n!)'
					] as const;

					// Simple heuristic-based complexity analysis
					// This is a basic implementation - a more sophisticated version would use AST parsing
					let timeComplexity: (typeof complexityOptions)[number] = 'O(1)';
					let spaceComplexity: (typeof complexityOptions)[number] = 'O(1)';

					const codeLines = code.toLowerCase().split('\n');
					let nestedLoops = 0;
					let hasRecursion = false;
					let hasArrayAllocation = false;
					let hasHashMap = false;

					// Analyze code patterns
					for (const line of codeLines) {
						// Count nested loops
						if (line.includes('for') || line.includes('while')) {
							nestedLoops++;
						}

						// Check for recursion
						if (line.includes('return') && (line.includes('(') || line.includes('function'))) {
							hasRecursion = true;
						}

						// Check for array/list allocations
						if (
							line.includes('new array') ||
							line.includes('new list') ||
							line.includes('[]') ||
							line.includes('list()')
						) {
							hasArrayAllocation = true;
						}

						// Check for hash maps/dictionaries
						if (
							line.includes('map') ||
							line.includes('dict') ||
							line.includes('{}') ||
							line.includes('hashmap')
						) {
							hasHashMap = true;
						}
					}

					// Determine time complexity
					if (hasRecursion) {
						if (code.includes('fibonacci') || code.includes('2^n')) {
							timeComplexity = 'O(2^n)';
						} else if (code.includes('factorial')) {
							timeComplexity = 'O(n!)';
						} else if (nestedLoops >= 2) {
							timeComplexity = 'O(n^2)';
						} else {
							timeComplexity = 'O(n)';
						}
					} else if (nestedLoops >= 3) {
						timeComplexity = 'O(n^3)';
					} else if (nestedLoops >= 2) {
						timeComplexity = 'O(n^2)';
					} else if (nestedLoops === 1) {
						if (code.includes('sort') || code.includes('merge') || code.includes('heap')) {
							timeComplexity = 'O(n log n)';
						} else {
							timeComplexity = 'O(n)';
						}
					} else if (code.includes('binary search') || code.includes('log')) {
						timeComplexity = 'O(log n)';
					}

					// Determine space complexity
					if (hasRecursion) {
						if (code.includes('fibonacci') || code.includes('2^n')) {
							spaceComplexity = 'O(2^n)';
						} else {
							spaceComplexity = 'O(n)'; // Stack space for recursion
						}
					} else if (hasArrayAllocation || hasHashMap) {
						spaceComplexity = 'O(n)';
					}

					return {
						timeComplexity,
						spaceComplexity,
						analysis: {
							nestedLoops,
							hasRecursion,
							hasArrayAllocation,
							hasHashMap,
							inputProvided: !!input
						}
					};
				}
			})
		}
	});

	return result.toUIMessageStreamResponse();
}
