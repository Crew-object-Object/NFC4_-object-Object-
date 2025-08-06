import { auth } from '$lib/auth';
import { createInterview, fetchInterviews, getAllUsers, updateInterview } from '$lib/interview-db';
import { VoiceTranscriptionService } from '$lib/voice-transcription';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { z } from 'zod';
import { LMSTUDIO_API_URL } from '$env/static/private';

const lmstudio = createOpenAICompatible({
	name: 'lmstudio',
	baseURL: LMSTUDIO_API_URL
});

export async function POST({ request, url }) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const { messages, roomId: requestRoomId }: { messages: UIMessage[]; roomId?: string } =
		await request.json();

	// Extract roomId from request body or from message content
	let roomId = requestRoomId;
	if (!roomId) {
		// Try to extract roomId from recent messages
		const recentMessages = messages.slice(-3);
		for (const msg of recentMessages) {
			if (msg.role === 'user') {
				const textPart = msg.parts?.find((part) => part.type === 'text');
				if (textPart) {
					// Look for roomId in quotes or after "roomId:"
					const roomMatch = textPart.text?.match(
						/roomId[:\s]*['""]([a-zA-Z0-9_-]+)['""]|room[:\s]+([a-zA-Z0-9_-]+)/i
					);
					if (roomMatch) {
						roomId = roomMatch[1] || roomMatch[2];
						console.log('Extracted roomId from message:', roomId);
						break;
					}
				}
			}
		}
	}

	console.log('Chat request for room:', roomId, 'with messages:', messages.length);

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
			getTranscriptHistory: tool({
				description:
					'Get the complete voice transcription history for the current interview session. This includes all spoken words from both the interviewer and interviewee with timestamps.',
				inputSchema: z.object({
					roomId: z
						.string()
						.optional()
						.describe('Room ID for the interview session (if not provided, will use current room)')
				}),
				execute: async ({ roomId: requestedRoomId }) => {
					const targetRoomId = requestedRoomId || roomId;
					console.log('Getting transcript history for room:', targetRoomId);

					if (!targetRoomId) {
						return { error: 'No room ID provided and no current room context available' };
					}

					const transcript = VoiceTranscriptionService.getFormattedTranscript(targetRoomId);
					const history = VoiceTranscriptionService.getTranscriptHistory(targetRoomId);

					console.log('Transcript history found:', {
						roomId: targetRoomId,
						entryCount: history.length,
						hasTranscript: transcript.length > 0
					});

					return {
						transcript,
						entryCount: history.length,
						roomId: targetRoomId,
						lastUpdate: history.length > 0 ? history[history.length - 1].timestamp : null
					};
				}
			}),
			generateFollowUpQuestions: tool({
				description:
					'Generate intelligent follow-up questions based on the conversation transcript and current code. Use this to help interviewers ask relevant technical questions.',
				inputSchema: z.object({
					roomId: z.string().optional().describe('Room ID for the interview session'),
					currentCode: z
						.string()
						.optional()
						.describe('Current code being discussed in the interview'),
					questionType: z
						.enum(['technical', 'behavioral', 'problem-solving', 'clarification'])
						.optional()
						.describe('Type of follow-up questions to generate')
				}),
				execute: async ({ roomId: requestedRoomId, currentCode, questionType = 'technical' }) => {
					const targetRoomId = requestedRoomId || roomId;
					if (!targetRoomId) {
						return { error: 'No room ID provided and no current room context available' };
					}

					const history = VoiceTranscriptionService.getTranscriptHistory(targetRoomId);

					// Generate contextual follow-up questions based on the last message
					const suggestions = [];

					if (history.length === 0) {
						suggestions.push(
							"What's your approach to solving this problem?",
							'Can you walk me through your thought process?',
							"What's the first step you'd take?"
						);
					} else {
						// Get only the last message to generate contextual questions
						const lastEntry = history[history.length - 1];
						const lastMessage = lastEntry.text.toLowerCase();
						const lastSpeaker = lastEntry.speaker;
						
						console.log('Generating questions based on last message:', {
							speaker: lastSpeaker,
							text: lastEntry.text,
							questionType
						});

						// Generate questions based on the actual content of the last message
						if (lastMessage.includes('algorithm') || lastMessage.includes('approach')) {
							suggestions.push(
								'Can you explain why you chose this particular algorithm?',
								'What other algorithms did you consider for this problem?',
								'How does this approach compare to alternatives?'
							);
						}
						
						if (lastMessage.includes('complexity') || lastMessage.includes('performance') || lastMessage.includes('time')) {
							suggestions.push(
								'Can you walk through the complexity analysis step by step?',
								'What happens to performance with very large inputs?',
								'Are there ways to optimize this further?'
							);
						}
						
						if (lastMessage.includes('sort') || lastMessage.includes('merge') || lastMessage.includes('quick')) {
							suggestions.push(
								'What are the trade-offs between different sorting approaches?',
								'When would you choose this sorting method over others?',
								'How does this handle edge cases like duplicate elements?'
							);
						}
						
						if (lastMessage.includes('data structure') || lastMessage.includes('array') || lastMessage.includes('list')) {
							suggestions.push(
								'Why did you choose this data structure?',
								'What are the memory implications of this choice?',
								'How would this scale with different data sizes?'
							);
						}
						
						if (lastMessage.includes('test') || lastMessage.includes('debug') || lastMessage.includes('error')) {
							suggestions.push(
								'How would you test this systematically?',
								'What edge cases should we consider?',
								'How would you debug if this wasn\'t working?'
							);
						}
						
						// If the last speaker was the candidate (remote), ask follow-up questions
						if (lastSpeaker === 'remote') {
							suggestions.push(
								'Can you elaborate on that point?',
								'What made you think of that solution?',
								'Can you trace through an example?'
							);
						}
						
						// Add code-specific questions if code is present
						if (currentCode) {
							suggestions.push(
								'Can you walk through this code with a specific example?',
								'What would happen if we changed the input constraints?',
								'How does this implementation handle edge cases?'
							);
						}
						
						// If we don't have enough contextual questions, add some general ones
						if (suggestions.length < 3) {
							suggestions.push(
								'Can you explain your reasoning behind this approach?',
								'What assumptions are you making about the input?',
								'How confident are you in this solution?'
							);
						}
					}

					return {
						suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
						lastMessage: history.length > 0 ? history[history.length - 1].text : null,
						lastSpeaker: history.length > 0 ? history[history.length - 1].speaker : null,
						questionType,
						hasCode: !!currentCode
					};
				}
			}),
			addTestTranscript: tool({
				description:
					'Add test transcript entries for debugging purposes. Use this to test the transcript functionality.',
				inputSchema: z.object({
					roomId: z.string().describe('Room ID to add test transcript entries for')
				}),
				execute: async ({ roomId: testRoomId }) => {
					console.log('Adding test transcript entries for room:', testRoomId);

					const entriesAdded = VoiceTranscriptionService.addTestTranscriptEntries(testRoomId);
					const updatedHistory = VoiceTranscriptionService.getTranscriptHistory(testRoomId);
					const transcript = VoiceTranscriptionService.getFormattedTranscript(testRoomId);

					return {
						message: 'Test transcript entries added successfully',
						entriesAdded,
						totalEntries: updatedHistory.length,
						roomId: testRoomId,
						transcript: transcript
					};
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
