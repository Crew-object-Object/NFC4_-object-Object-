<script lang="ts">
	import { page } from '$app/stores';
	import VideoCall from '$lib/components/video-call.svelte';
	import TiptapEditor from '$lib/components/tiptap.svelte';
	import InterviewChat from '$lib/components/interview-chat.svelte';
	import AddProblemDialog from '$lib/components/add-problem-dialog.svelte';
	import AddTestCaseDialog from '$lib/components/add-test-case-dialog.svelte';
	import InterviewerChatbot from '$lib/components/interviewer-chatbot.svelte';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import GripHorizontalIcon from '@lucide/svelte/icons/grip-horizontal';
	import FlaskConicalIcon from '@lucide/svelte/icons/flask-conical';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CodeIcon from '@lucide/svelte/icons/code';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Select from '$lib/components/ui/select';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Clock, PhoneOff, Timer, Bot } from 'lucide-svelte';
	import type { Problem } from '$lib/problemset';
	import { browser } from '$app/environment';
	import { authClient, useSession } from '$lib/auth-client';
	import { sseClient, type ProblemAddedMessage, type TestCaseAddedMessage } from '$lib/sse-client';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	interface InterviewProblem {
		id: string;
		title: string;
		description: string;
		score: number;
		testCases: {
			testCaseId: string;
			input: string;
			output: string;
		}[];
	}

	// Problem management state
	let availableProblems = $state<Problem[]>([]);
	let interviewProblems = $state<InterviewProblem[]>([]);
	let showProblemDialog = $state(false);
	let showAddTestCaseDialog = $state(false);
	let selectedInterviewProblem = $state<InterviewProblem | null>(null);
	let isLoadingProblems = $state(false);
	let sseConnected = $state(false);
	let connectionError = $state('');

	// Get room ID from URL
	const roomId = $derived($page.params.roomId);

	// Fetch available problems from problemset
	const fetchAvailableProblems = async () => {
		try {
			const response = await fetch('/api/problemset');
			const result = await response.json();

			if (result.success) {
				availableProblems = result.data;
			} else {
				console.error('Failed to fetch problemset:', result.error);
			}
		} catch (error) {
			console.error('Error fetching problemset:', error);
		}
	};

	// Fetch problems for current interview
	const fetchInterviewProblems = async () => {
		if (!roomId) return;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`);
			const result = await response.json();

			if (result.success) {
				interviewProblems = result.data;
			} else {
				console.error('Failed to fetch interview problems:', result.error);
			}
		} catch (error) {
			console.error('Error fetching interview problems:', error);
		}
	};

	// Add selected problem from problemset to interview
	const handleAddProblemFromSet = async (event: CustomEvent<{ problem: Problem }>) => {
		if (!roomId || isLoadingProblems) return;

		isLoadingProblems = true;
		const { problem } = event.detail;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: problem.title,
					description: problem.description,
					testCases: problem.testCases
				})
			});

			const result = await response.json();

			if (result.success) {
				showProblemDialog = false;
			} else {
				console.error('Failed to add problem:', result.error);
			}
		} catch (error) {
			console.error('Error adding problem:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// Add custom problem to interview
	const handleAddCustomProblem = async (
		event: CustomEvent<{ title: string; description: string }>
	) => {
		if (!roomId || isLoadingProblems) return;

		isLoadingProblems = true;
		const { title, description } = event.detail;

		try {
			const response = await fetch(`/api/interviews/${roomId}/problems`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: title,
					description: description,
					testCases: []
				})
			});

			const result = await response.json();

			if (result.success) {
				showProblemDialog = false;
			} else {
				console.error('Failed to add custom problem:', result.error);
			}
		} catch (error) {
			console.error('Error adding custom problem:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// Add test case to problem
	const handleAddTestCase = async (
		event: CustomEvent<{ input: string; output: string; problemId: string }>
	) => {
		if (isLoadingProblems) return;

		isLoadingProblems = true;
		const { input, output, problemId } = event.detail;

		try {
			const response = await fetch(`/api/problems/${problemId}/testcases`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					input: input,
					output: output
				})
			});

			const result = await response.json();

			if (result.success) {
				showAddTestCaseDialog = false;
				selectedInterviewProblem = null;
			} else {
				console.error('Failed to add test case:', result.error);
			}
		} catch (error) {
			console.error('Error adding test case:', error);
		} finally {
			isLoadingProblems = false;
		}
	};

	// State for code execution
	let currentCode = $state('');
	
	// Voice transcription state (shared with video component)
	let isTranscriptionEnabled = $state(false);
	let selectedProblemForSubmission = $state<any>(null);
	let selectedTestCase = $state<any>(null);
	let isExecuting = $state(false);
	let executionResults = $state<any[]>([]);
	let currentExecutingTestCase = $state(-1); // Track which test case is currently executing
	let showSubmissionDialog = $state(false);

	// Function to handle code content changes from TiptapEditor
	const handleCodeChange = (code: string) => {
		currentCode = code;
	};

	// Submit code for execution
	const submitCode = async () => {
		if (!selectedProblemForSubmission || !currentCode.trim() || isExecuting) return;

		isExecuting = true;
		executionResults = [];
		currentExecutingTestCase = -1;

		try {
			// Run code against all test cases for the selected problem
			const testCases = selectedProblemForSubmission.testCases;

			for (let i = 0; i < testCases.length; i++) {
				const testCase = testCases[i];
				currentExecutingTestCase = i;

				try {
					const response = await fetch('/api/submit', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							code: currentCode,
							language_id: '10', // Python 3
							input: testCase.input
						})
					});

					const result = await response.json();

					if (result.error) {
						executionResults.push({
							testCaseIndex: i + 1,
							input: testCase.input,
							expectedOutput: testCase.output.trim(),
							actualOutput: '',
							passed: false,
							error: result.error,
							executionTime: 0,
							memory: 0,
							status: 'error'
						});
						continue;
					}

					// Compare output with expected
					const actualOutput = result.stdout?.trim() || '';
					const expectedOutput = testCase.output.trim();
					const passed = actualOutput === expectedOutput;

					executionResults.push({
						testCaseIndex: i + 1,
						input: testCase.input,
						expectedOutput: expectedOutput,
						actualOutput: actualOutput,
						passed: passed,
						error: result.stderr || null,
						executionTime: parseFloat(result.time) || 0,
						memory: parseInt(result.memory) || 0,
						status: result.status?.description || 'Unknown',
						statusId: result.status?.id || 0
					});
				} catch (error) {
					console.error(`Error executing test case ${i + 1}:`, error);
					executionResults.push({
						testCaseIndex: i + 1,
						input: testCase.input,
						expectedOutput: testCase.output,
						actualOutput: '',
						passed: false,
						error: 'Network error or execution failed',
						executionTime: 0,
						memory: 0,
						status: 'error',
						statusId: 0
					});
				}
			}

			// Calculate score based on passed test cases
			const passedTestCases = executionResults.filter((result) => result.passed).length;
			const totalTestCases = executionResults.length;

			// Update the problem score in the database
			try {
				const response = await fetch(`/api/problems/${selectedProblemForSubmission.id}/score`, {
					method: 'PATCH',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						totalTestCases: totalTestCases,
						passedTestCases: passedTestCases
					})
				});

				const result = await response.json();

				if (result.success) {
					// Update the local problem score with the percentage score from the API
					interviewProblems = interviewProblems.map((problem) => {
						if (problem.id === selectedProblemForSubmission.id) {
							return {
								...problem,
								score: result.data.score // This is the percentage score from the API
							};
						}
						return problem;
					});

					console.log(
						`Problem score updated: ${passedTestCases}/${totalTestCases} test cases passed (${result.data.percentageScore}%)`
					);

					// Send notification about score update
					if (sseClient.isConnected) {
						const userName = $session.data?.user?.name || 'Interviewee';
						const scoreText = result.data.isNewMaxScore
							? `NEW HIGH SCORE: ${result.data.percentageScore}%`
							: `Score: ${result.data.percentageScore}%`;
						const message = `📊 ${userName} submitted solution for "${selectedProblemForSubmission.title}" - ${scoreText} (${passedTestCases}/${totalTestCases} test cases passed)`;
						await sseClient.sendMessage(message);
					}
				} else {
					console.error('Failed to update problem score:', result.error);
				}
			} catch (error) {
				console.error('Error updating problem score:', error);
			}
		} catch (error) {
			console.error('Error during code submission:', error);
		} finally {
			isExecuting = false;
			currentExecutingTestCase = -1;
		}
	};

	const session = useSession();

	// Check if current user is interviewer
	let isInterviewer = $state(false);

	// Check if current user is interviewee
	let isInterviewee = $state(false);

	// Interview timer and end interview functionality
	let interview = $state<any>(null);
	let elapsedTime = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let showEndInterviewDialog = $state(false);
	let isEndingInterview = $state(false);
	let canJoinInterview = $state(false);
	let timeUntilStart = $state(0);
	let isLoadingInterview = $state(true);
	let interviewScore = $state<string>('');
	let scoreError = $state<string>('');

	// AI Chatbot state for interviewers
	let showChatbot = $state(false);

	// Format elapsed time as HH:MM:SS
	const formatElapsedTime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (hours > 0) {
			return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

	// Format time until start as readable string
	const formatTimeUntilStart = (seconds: number) => {
		if (seconds <= 0) return '';

		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${mins}m`;
		} else if (mins > 0) {
			return `${mins}m`;
		} else {
			return `${seconds}s`;
		}
	};

	// Fetch interview details
	const fetchInterviewDetails = async () => {
		if (!roomId) return;

		isLoadingInterview = true;
		try {
			const response = await fetch(`/api/interviews/${roomId}/details`);
			const result = await response.json();

			if (result.success) {
				interview = result.data;
				checkInterviewTiming();
			} else {
				console.error('Failed to fetch interview details:', result.error);
			}
		} catch (error) {
			console.error('Error fetching interview details:', error);
		} finally {
			isLoadingInterview = false;
		}
	};

	// Check if interview can be joined and calculate times
	const checkInterviewTiming = () => {
		if (!interview) return;

		const now = new Date();
		const startTime = new Date(interview.startTime);
		const endTime = new Date(interview.endTime);

		// Check if current time is within interview window
		if (now >= startTime && now <= endTime) {
			canJoinInterview = true;
			timeUntilStart = 0;

			// Calculate elapsed time since start
			const elapsedMs = now.getTime() - startTime.getTime();
			elapsedTime = Math.floor(elapsedMs / 1000);
		} else if (now < startTime) {
			canJoinInterview = false;

			// Calculate time until start
			const timeUntilMs = startTime.getTime() - now.getTime();
			timeUntilStart = Math.floor(timeUntilMs / 1000);
		} else {
			// Interview has ended
			canJoinInterview = false;
			timeUntilStart = 0;

			// Calculate total duration
			const totalMs = endTime.getTime() - startTime.getTime();
			elapsedTime = Math.floor(totalMs / 1000);
		}
	};

	// Start the interview timer
	const startInterviewTimer = () => {
		if (timerInterval) return;

		timerInterval = setInterval(() => {
			checkInterviewTiming();
		}, 1000);
	};

	// Stop the interview timer
	const stopInterviewTimer = () => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	// End the interview
	const endInterview = async () => {
		if (!roomId || isEndingInterview) return;

		// Validate score input
		const score = parseInt(interviewScore);
		if (!interviewScore || isNaN(score) || score < 0 || score > 100) {
			scoreError = 'Please enter a valid score between 0-100';
			return;
		}

		scoreError = '';
		isEndingInterview = true;
		try {
			const response = await fetch(`/api/interviews/${roomId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					status: 'COMPLETED',
					interviewScore: score
				})
			});

			const result = await response.json();

			if (result.success) {
				stopInterviewTimer();
				showEndInterviewDialog = false;

				// Send notification through SSE
				if (sseClient.isConnected) {
					await sseClient.sendMessage(
						`🎉 Interview has been ended by the interviewer. Final Score: ${score}%`
					);
				}

				// Redirect to dashboard after a short delay
				setTimeout(() => {
					goto('/dashboard');
				}, 2000);
			} else {
				console.error('Failed to end interview:', result.error);
				scoreError = result.error || 'Failed to end interview';
			}
		} catch (error) {
			console.error('Error ending interview:', error);
			scoreError = 'Network error occurred';
		} finally {
			isEndingInterview = false;
		}
	};

	// Initialize SSE connection for real-time updates
	const initializeSSE = async () => {
		if (!roomId) return;

		try {
			await sseClient.connect(roomId);
			sseConnected = true;
			connectionError = '';
		} catch (error) {
			console.error('Failed to connect SSE:', error);
			connectionError = 'Failed to connect';
			sseConnected = false;
		}
	};

	// SSE event handlers
	const handleProblemAdded = (problem: ProblemAddedMessage) => {
		const newProblem: InterviewProblem = {
			id: problem.id,
			title: problem.title,
			description: problem.description,
			score: problem.score,
			testCases: problem.testCases
		};
		interviewProblems = [...interviewProblems, newProblem];
	};

	const handleTestCaseAdded = (data: TestCaseAddedMessage) => {
		interviewProblems = interviewProblems.map((problem) => {
			if (problem.id === data.problemId) {
				return {
					...problem,
					testCases: [...problem.testCases, data.testCase]
				};
			}
			return problem;
		});
	};

	// Handle incoming chat messages to detect system alerts
	const handleChatMessage = (message: any) => {
		// If this is a system alert and the current user is the interviewer
		if (isInterviewer && message.content && message.content.includes('SYSTEM ALERT')) {
			console.log('System alert received by interviewer:', message.content);

			// You could add additional notifications here, like:
			// - Browser notifications
			// - Sound alerts
			// - Visual highlights

			// For now, just log it prominently
			if (message.content.includes('switched tabs')) {
				console.warn('🚨 INTERVIEWER ALERT: Candidate switched tabs/applications!');
			} else if (message.content.includes('pasted content')) {
				console.warn('📋 INTERVIEWER ALERT: Candidate pasted content into editor!');
			}
		}
	};

	const handleSSEError = (error: string) => {
		console.error('SSE error:', error);
		connectionError = error;
		sseConnected = false;
	};

	const handleSSEConnect = () => {
		sseConnected = true;
		connectionError = '';
		console.log('SSE connected');
	};

	const handleSSEDisconnect = () => {
		sseConnected = false;
		console.log('SSE disconnected');
	};

	$effect(() => {
		if (!$session.isPending) {
			isInterviewer = $session.data?.user.role === 'Interviewer';
			isInterviewee = !isInterviewer;

			// Fetch interview details and start timer when user role is determined
			if (browser && !timerInterval) {
				fetchInterviewDetails();
				startInterviewTimer();
			}
		}
	});

	// Setup tab detection when user role is determined and they are an interviewee
	$effect(() => {
		if (browser && isInterviewee && roomId) {
			console.log('Role determined: Setting up tab detection for interviewee');
			setupTabDetection();
		}
	});

	// Tab switching detection for interviewees
	let isTabVisible = $state(true);
	let isWindowFocused = $state(true);
	let tabSwitchCount = $state(0);
	let lastTabSwitchTime = 0;
	let tabSwitchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Paste detection for interviewees
	let pasteCount = $state(0);
	let lastPasteTime = 0;

	// Function to send tab switch notification
	const sendTabSwitchNotification = async () => {
		if (!roomId || !isInterviewee) return;

		try {
			// Ensure SSE is connected before sending message
			if (!sseClient.isConnected) {
				await sseClient.connect(roomId);
			}

			tabSwitchCount++;
			const userName = $session.data?.user?.name || 'Interviewee';
			const message = `🚨 SYSTEM ALERT: ${userName} switched tabs/applications (Total: ${tabSwitchCount} time${tabSwitchCount > 1 ? 's' : ''})`;
			await sseClient.sendMessage(message);
			console.log('Tab switch notification sent to all participants:', message);
		} catch (error) {
			console.error('Failed to send tab switch notification:', error);
		}
	};

	// Function to send paste detection notification
	const sendPasteNotification = async () => {
		if (!roomId || !isInterviewee) return;

		const currentTime = Date.now();

		// Prevent multiple rapid notifications (debounce with 2 seconds)
		if (currentTime - lastPasteTime < 2000) {
			console.log('Paste notification ignored due to debouncing');
			return;
		}

		try {
			// Ensure SSE is connected before sending message
			if (!sseClient.isConnected) {
				await sseClient.connect(roomId);
			}

			lastPasteTime = currentTime;
			pasteCount++;
			const userName = $session.data?.user?.name || 'Interviewee';
			const message = `📋 SYSTEM ALERT: ${userName} pasted content into the code editor (Total: ${pasteCount} time${pasteCount > 1 ? 's' : ''})`;
			await sseClient.sendMessage(message);
			console.log('Paste notification sent to all participants:', message);
		} catch (error) {
			console.error('Failed to send paste notification:', error);
		}
	};

	// Handle visibility change (tab switching within browser)
	const handleVisibilityChange = async () => {
		if (!browser || !roomId || !isInterviewee) return;

		const isCurrentlyVisible = !document.hidden;
		const currentTime = Date.now();

		console.log('Visibility change:', {
			isCurrentlyVisible,
			isTabVisible,
			isInterviewee,
			roomId
		});

		// Only track when tab becomes hidden (user switched away)
		if (isTabVisible && !isCurrentlyVisible) {
			console.log('Tab switch detected (visibility)');

			// Prevent multiple rapid notifications (debounce with 1 second)
			if (currentTime - lastTabSwitchTime < 1000) {
				console.log('Tab switch ignored due to debouncing');
				return;
			}

			lastTabSwitchTime = currentTime;
			await sendTabSwitchNotification();
		}

		isTabVisible = isCurrentlyVisible;
	};

	// Handle window blur (alt+tab, clicking outside browser, etc.)
	const handleWindowBlur = async () => {
		if (!browser || !roomId || !isInterviewee) return;

		const currentTime = Date.now();

		console.log('Window blur detected for interviewee');

		// Only track when window loses focus
		if (isWindowFocused) {
			// Prevent multiple rapid notifications (debounce with 1 second)
			if (currentTime - lastTabSwitchTime < 1000) {
				console.log('Window blur ignored due to debouncing');
				return;
			}

			// Use a small timeout to confirm it's a real focus loss
			if (tabSwitchTimeout) {
				clearTimeout(tabSwitchTimeout);
			}

			tabSwitchTimeout = setTimeout(async () => {
				// Double check that window is still blurred
				if (!document.hasFocus()) {
					lastTabSwitchTime = currentTime;
					await sendTabSwitchNotification();
				}
			}, 200);
		}

		isWindowFocused = false;
	};

	// Handle window focus
	const handleWindowFocus = () => {
		console.log('Window focus gained');
		isWindowFocused = true;
		isTabVisible = true;

		// Clear any pending timeout when focus returns
		if (tabSwitchTimeout) {
			clearTimeout(tabSwitchTimeout);
			tabSwitchTimeout = null;
		}
	};

	// Handle keyboard shortcuts that might indicate app switching
	const handleKeyDown = async (event: KeyboardEvent) => {
		if (!browser || !roomId || !isInterviewee) return;

		// Detect Alt+Tab (Windows/Linux) or Cmd+Tab (Mac)
		const isAltTab = event.altKey && event.key === 'Tab';
		const isCmdTab = event.metaKey && event.key === 'Tab';

		if (isAltTab || isCmdTab) {
			console.log('App switching keyboard shortcut detected:', { isAltTab, isCmdTab });

			const currentTime = Date.now();

			// Prevent multiple rapid notifications
			if (currentTime - lastTabSwitchTime < 1000) {
				return;
			}

			// Small delay to check if the user actually switched
			setTimeout(async () => {
				if (!document.hasFocus()) {
					lastTabSwitchTime = currentTime;
					await sendTabSwitchNotification();
				}
			}, 300);
		}
	};

	const setupTabDetection = () => {
		if (!browser) return;

		console.log('Setting up tab detection event listeners');

		// Listen for visibility changes (tab switches within browser)
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Listen for window blur/focus events (alt+tab, clicking outside browser)
		window.addEventListener('blur', handleWindowBlur);
		window.addEventListener('focus', handleWindowFocus);

		// Listen for keyboard shortcuts
		document.addEventListener('keydown', handleKeyDown);

		// Initialize states
		isTabVisible = !document.hidden;
		isWindowFocused = document.hasFocus();
	};

	const cleanupTabDetection = () => {
		if (!browser) return;

		console.log('Cleaning up tab detection event listeners');

		// Clear any pending timeout
		if (tabSwitchTimeout) {
			clearTimeout(tabSwitchTimeout);
			tabSwitchTimeout = null;
		}

		// Remove event listeners
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('blur', handleWindowBlur);
		window.removeEventListener('focus', handleWindowFocus);
		document.removeEventListener('keydown', handleKeyDown);
	};

	$effect(() => {
		if (roomId) {
			// Debug role detection
			console.log('User role detection:', {
				isInterviewer: isInterviewer,
				isInterviewee: isInterviewee,
				urlParams: browser ? new URLSearchParams(window.location.search).get('role') : null
			});

			if (canJoinInterview) {
				fetchInterviewProblems();
				if (isInterviewer) {
					fetchAvailableProblems();
				}
				initializeSSE();
			}
		}
	});

	onMount(() => {
		// Setup SSE event handlers
		const unsubscribeProblemAdded = sseClient.onProblemAdded(handleProblemAdded);
		const unsubscribeTestCaseAdded = sseClient.onTestCaseAdded(handleTestCaseAdded);
		const unsubscribeMessage = sseClient.onMessage(handleChatMessage);
		const unsubscribeError = sseClient.onError(handleSSEError);
		const unsubscribeConnect = sseClient.onConnect(handleSSEConnect);
		const unsubscribeDisconnect = sseClient.onDisconnect(handleSSEDisconnect);

		return () => {
			unsubscribeProblemAdded();
			unsubscribeTestCaseAdded();
			unsubscribeMessage();
			unsubscribeError();
			unsubscribeConnect();
			unsubscribeDisconnect();
		};
	});

	onDestroy(() => {
		// Cleanup tab detection
		cleanupTabDetection();

		// Stop interview timer
		stopInterviewTimer();

		// Disconnect SSE if connected
		if (sseConnected) {
			sseClient.disconnect();
		}
	});
</script>

<main class="h-px grow px-4 py-0">
	{#if isLoadingInterview || $session.isPending}
		<!-- Loading state -->
		<div class="h-full overflow-hidden rounded-lg border">
			<div class="flex items-center justify-between border-b bg-background px-4 py-2">
				<div class="flex items-center gap-4">
					<Skeleton class="h-5 w-32" />
					<Skeleton class="h-6 w-16" />
				</div>
				<Skeleton class="h-8 w-24" />
			</div>

			<div class="flex h-full">
				<!-- Editor Section Skeleton -->
				<div class="flex-1 border-r">
					<div class="flex h-full flex-col">
						<!-- Code Editor Header -->
						<div class="flex items-center justify-between border-b px-4 py-2">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-6 w-20" />
						</div>
						<!-- Editor Content -->
						<div class="flex-1 space-y-2 p-4">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-3/4" />
							<Skeleton class="h-4 w-1/2" />
							<Skeleton class="h-4 w-5/6" />
						</div>

						<!-- Test Cases Section -->
						<div class="border-t">
							<div class="flex items-center justify-between border-b px-4 py-2">
								<Skeleton class="h-4 w-32" />
								<Skeleton class="h-6 w-20" />
							</div>
							<div class="space-y-3 p-4">
								<Skeleton class="h-16 w-full" />
								<Skeleton class="h-16 w-full" />
							</div>
						</div>
					</div>
				</div>

				<!-- Right Panel Skeleton -->
				<div class="w-96">
					<div class="flex h-full flex-col">
						<!-- Video Section -->
						<div class="flex-1 border-b p-4">
							<Skeleton class="h-full w-full rounded-lg" />
						</div>

						<!-- Chat Section -->
						<div class="flex-1 space-y-2 p-4">
							<Skeleton class="h-4 w-16" />
							<Skeleton class="h-8 w-full" />
							<Skeleton class="h-8 w-3/4" />
							<Skeleton class="h-8 w-1/2" />
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if !canJoinInterview && timeUntilStart > 0}
		<!-- Interview hasn't started yet -->
		<div class="flex h-full items-center justify-center">
			<div class="space-y-4 rounded-lg border bg-card p-8 text-center">
				<div class="flex items-center justify-center gap-2 text-muted-foreground">
					<Timer size={24} />
					<h2 class="text-xl font-semibold">Interview Not Started</h2>
				</div>
				<p class="text-muted-foreground">The interview is scheduled to start in:</p>
				<div class="font-mono text-3xl font-bold text-primary">
					{formatTimeUntilStart(timeUntilStart)}
				</div>
				{#if interview}
					<div class="space-y-1 text-sm text-muted-foreground">
						<p><strong>Title:</strong> {interview.interviewTitle}</p>
						<p><strong>Start Time:</strong> {new Date(interview.startTime).toLocaleString()}</p>
						<p><strong>End Time:</strong> {new Date(interview.endTime).toLocaleString()}</p>
					</div>
				{/if}
				<p class="text-xs text-muted-foreground">
					Please wait until the scheduled time to join the interview.
				</p>
			</div>
		</div>
	{:else if !canJoinInterview && timeUntilStart === 0}
		<!-- Interview has ended -->
		<div class="flex h-full items-center justify-center">
			<div class="space-y-4 rounded-lg border bg-card p-8 text-center">
				<div class="flex items-center justify-center gap-2 text-muted-foreground">
					<Clock size={24} />
					<h2 class="text-xl font-semibold">Interview Ended</h2>
				</div>
				<p class="text-muted-foreground">This interview has already ended.</p>
				{#if interview}
					<div class="space-y-1 text-sm text-muted-foreground">
						<p><strong>Title:</strong> {interview.interviewTitle}</p>
						<p><strong>Duration:</strong> {formatElapsedTime(elapsedTime)}</p>
						<p><strong>Status:</strong> {interview.status}</p>
					</div>
				{/if}
				<Button href="/dashboard" variant="outline">Back to Dashboard</Button>
			</div>
		</div>
	{:else}
		<!-- Interview is active -->
		<div class="relative h-full overflow-hidden rounded-lg border">
			<!-- Interview Header with Timer and End Button -->
			{#if isInterviewer}
				<div class="flex items-center justify-between border-b bg-background px-4 py-2">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2">
							<Timer size={16} class="text-primary" />
							<span class="text-sm font-medium">Interview Time:</span>
							<Badge variant="outline" class="font-mono text-sm">
								{formatElapsedTime(elapsedTime)}
							</Badge>
						</div>
						<div class="flex items-center gap-1">
							{#if sseConnected}
								<div class="h-2 w-2 rounded-full bg-green-500"></div>
								<span class="text-xs text-green-600">Live</span>
							{:else}
								<div class="h-2 w-2 rounded-full bg-red-500"></div>
								<span class="text-xs text-red-600">
									{connectionError || 'Offline'}
								</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							class="gap-2"
							onclick={() => (showChatbot = true)}
							title="Open AI Assistant"
						>
							<Bot size={14} class="text-primary" />
							<span class="hidden lg:inline">AI Assistant</span>
						</Button>
						<Button
							variant="destructive"
							size="sm"
							class="gap-2"
							onclick={() => {
								showEndInterviewDialog = true;
								interviewScore = '';
								scoreError = '';
							}}
							disabled={isEndingInterview}
						>
							<PhoneOff size={14} />
							{isEndingInterview ? 'Ending...' : 'End Interview'}
						</Button>
					</div>
				</div>
			{/if}

			<PaneGroup direction="horizontal">
				<!-- Editor Section -->
				<Pane defaultSize={60} minSize={40}>
					<PaneGroup direction="vertical">
						<!-- Code Editor -->
						<Pane defaultSize={75} minSize={50}>
							<div class="flex h-full flex-col bg-background">
								<div class="flex items-center justify-between border-b px-4 py-2">
									<div class="flex items-center gap-2">
										<CodeIcon size={16} />
										<h3 class="text-sm font-medium">Code Editor</h3>
										{#if isInterviewee && (tabSwitchCount > 0 || pasteCount > 0)}
											<div class="flex items-center gap-2">
												{#if tabSwitchCount > 0}
													<Badge
														variant="outline"
														class="bg-orange-50 text-xs text-orange-600 dark:bg-orange-950 dark:text-orange-400"
														title="Number of times you've switched tabs (visible to interviewer)"
													>
														Tab switches: {tabSwitchCount}
													</Badge>
												{/if}
												{#if pasteCount > 0}
													<Badge
														variant="outline"
														class="bg-red-50 text-xs text-red-600 dark:bg-red-950 dark:text-red-400"
														title="Number of times you've pasted content (visible to interviewer)"
													>
														Paste events: {pasteCount}
													</Badge>
												{/if}
											</div>
										{/if}
									</div>
									<div class="flex items-center gap-2">
										{#if isInterviewee}
											<Button
												size="sm"
												variant="outline"
												class="h-8 px-2 text-xs"
												onclick={() => (showSubmissionDialog = true)}
												disabled={!currentCode.trim() || interviewProblems.length === 0}
											>
												<PlayIcon size={12} class="mr-1" />
												Run Tests
											</Button>
										{/if}
									</div>
								</div>
								<div class="flex-1 p-4">
									<TiptapEditor
										{roomId}
										onContentChange={handleCodeChange}
										{isInterviewee}
										onPasteDetected={sendPasteNotification}
									/>
								</div>
							</div>
						</Pane>

						<PaneResizer
							class="group flex h-2 items-center justify-center bg-border transition-colors hover:bg-accent"
						>
							<div class="opacity-60 transition-opacity group-hover:opacity-100">
								<GripHorizontalIcon size={16} />
							</div>
						</PaneResizer>

						<!-- Test Cases Section -->
						<Pane defaultSize={25} minSize={20} class="overflow-auto pb-12">
							<div class="flex h-full flex-col bg-background">
								<div class="flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
									<div class="flex items-center gap-2">
										<FlaskConicalIcon size={16} />
										<h3 class="text-sm font-medium">Problems & Test Cases</h3>
									</div>
									<div class="flex items-center gap-2">
										{#if isInterviewer}
											<Button
												size="sm"
												variant="outline"
												class="h-8 px-2 text-xs"
												onclick={() => (showProblemDialog = true)}
											>
												<PlusIcon size={12} class="mr-1" />
												Add Problem
											</Button>
										{/if}
										<!-- Connection Status -->
										{#if !isInterviewer}
											<div class="flex items-center gap-1">
												{#if sseConnected}
													<div class="flex items-center gap-1">
														<div class="h-2 w-2 rounded-full bg-green-500"></div>
														<span class="text-xs text-green-600">Live</span>
													</div>
												{:else}
													<div class="flex items-center gap-1">
														<div class="h-2 w-2 rounded-full bg-red-500"></div>
														<span class="text-xs text-red-600">
															{connectionError || 'Offline'}
														</span>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</div>
								<ScrollArea class="min-h-0 flex-1 p-2">
									{#if interviewProblems.length === 0}
										<div class="py-8 text-center text-sm text-muted-foreground">
											<FlaskConicalIcon size={32} class="mx-auto mb-2 opacity-50" />
											<p>No problems added yet.</p>
											{#if isInterviewer}
												<Button
													size="sm"
													variant="outline"
													class="mt-2"
													onclick={() => (showProblemDialog = true)}
												>
													Add First Problem
												</Button>
											{/if}
										</div>
									{:else}
										<div class="space-y-3">
											{#each interviewProblems as problem}
												<div class="rounded-lg border p-3">
													<div class="mb-2 flex items-start justify-between">
														<div class="flex-1">
															<div class="flex items-center gap-2">
																<h4 class="text-sm font-semibold">{problem.title}</h4>
																{#if problem.score > 0 || isInterviewee}
																	<Badge
																		variant={problem.score === problem.testCases.length
																			? 'default'
																			: problem.score > 0
																				? 'secondary'
																				: 'outline'}
																		class="text-xs"
																	>
																		Score: {problem.score}/{problem.testCases.length}
																	</Badge>
																{/if}
															</div>
															<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
																{problem.description}
															</p>
														</div>
														{#if isInterviewer}
															<Button
																size="sm"
																variant="ghost"
																class="h-6 px-1 text-xs"
																onclick={() => {
																	selectedInterviewProblem = problem;
																	showAddTestCaseDialog = true;
																}}
															>
																<PlusIcon size={10} />
															</Button>
														{/if}
													</div>

													{#if problem.testCases.length > 0}
														<div class="space-y-2">
															{#each problem.testCases as testCase, index}
																<div class="rounded border bg-muted/50 p-2">
																	<div class="mb-1 flex items-center justify-between">
																		<span class="text-xs font-medium text-muted-foreground"
																			>Test Case {index + 1}</span
																		>
																		<div class="h-2 w-2 rounded-full bg-gray-400"></div>
																	</div>
																	<div class="grid grid-cols-2 gap-1">
																		<div>
																			<div class="mb-1 text-xs font-medium text-muted-foreground">
																				Input
																			</div>
																			<div
																				class="max-h-12 overflow-y-auto rounded border bg-background p-1 text-xs"
																			>
																				{testCase.input}
																			</div>
																		</div>
																		<div>
																			<div class="mb-1 text-xs font-medium text-muted-foreground">
																				Expected
																			</div>
																			<div
																				class="max-h-12 overflow-y-auto rounded border bg-background p-1 text-xs"
																			>
																				{testCase.output}
																			</div>
																		</div>
																	</div>
																</div>
															{/each}
														</div>
													{:else}
														<div class="py-2 text-center text-xs text-muted-foreground">
															No test cases added yet.
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</ScrollArea>
							</div>
						</Pane>
					</PaneGroup>
				</Pane>

				<PaneResizer
					class="group flex w-2 items-center justify-center bg-border transition-colors hover:bg-accent"
				>
					<div class="opacity-60 transition-opacity group-hover:opacity-100">
						<GripVerticalIcon size={16} />
					</div>
				</PaneResizer>

				<!-- Right Side Panel -->
				<Pane defaultSize={40} minSize={30}>
					<PaneGroup direction="vertical">
						<!-- Video Section -->
						<Pane defaultSize={50} minSize={25}>
							{#if roomId}
								<VideoCall {roomId} bind:isTranscriptionEnabled />
							{/if}
						</Pane>

						<PaneResizer
							class="group flex h-2 items-center justify-center bg-border transition-colors hover:bg-accent"
						>
							<div class="opacity-60 transition-opacity group-hover:opacity-100">
								<GripHorizontalIcon size={16} />
							</div>
						</PaneResizer>

						<!-- Chat Section -->
						<Pane defaultSize={50} minSize={25} class="overflow-auto pb-12">
							{#if roomId}
								<InterviewChat {roomId} />
							{/if}
						</Pane>
					</PaneGroup>
				</Pane>
			</PaneGroup>
		</div>
	{/if}
</main>

<!-- Problem Management Components -->
<AddProblemDialog
	bind:open={showProblemDialog}
	{availableProblems}
	isLoading={isLoadingProblems}
	{roomId}
	on:close={() => (showProblemDialog = false)}
	on:addProblemFromSet={handleAddProblemFromSet}
	on:addCustomProblem={handleAddCustomProblem}
/>

<AddTestCaseDialog
	bind:open={showAddTestCaseDialog}
	selectedProblem={selectedInterviewProblem}
	isLoading={isLoadingProblems}
	on:close={() => {
		showAddTestCaseDialog = false;
		selectedInterviewProblem = null;
	}}
	on:addTestCase={handleAddTestCase}
/>

<!-- Code Submission Sheet -->
<Sheet.Root bind:open={showSubmissionDialog}>
	<Sheet.Content side="right" class="max-h-screen w-full overflow-y-auto p-6 sm:max-w-4xl">
		<Sheet.Header>
			<Sheet.Title>Run Code Tests</Sheet.Title>
			<Sheet.Description>
				Select a problem and run your code against its test cases.
			</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-6 py-6">
			<!-- Problem Selection -->
			<div class="space-y-3">
				<Label>Select Problem</Label>
				<Select.Root
					type="single"
					value={selectedProblemForSubmission?.id}
					onValueChange={(value) => {
						selectedProblemForSubmission = interviewProblems.find((p) => p.id === value) || null;
					}}
				>
					<Select.Trigger class="w-full">
						<span class="truncate">
							{selectedProblemForSubmission?.title || 'Choose a problem to test...'}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each interviewProblems as problem}
							<Select.Item value={problem.id}>
								{problem.title} ({problem.testCases.length} test cases) - Score: {problem.score}/{problem
									.testCases.length}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if selectedProblemForSubmission}
				<!-- Problem Details -->
				<div class="rounded-lg border bg-muted/50 p-4">
					<h3 class="mb-2 font-semibold">{selectedProblemForSubmission.title}</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						{selectedProblemForSubmission.description}
					</p>
					<div class="text-xs text-muted-foreground">
						<strong>Test Cases:</strong>
						{selectedProblemForSubmission.testCases.length}
					</div>
				</div>

				<!-- Execution Results -->
				{#if isExecuting || executionResults.length > 0}
					<div class="space-y-3">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-medium">Test Results</h3>
							{#if isExecuting}
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<div
										class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
									></div>
									{#if currentExecutingTestCase >= 0}
										Running test case {currentExecutingTestCase + 1}/{selectedProblemForSubmission
											?.testCases?.length || 0}
									{:else}
										Preparing execution...
									{/if}
								</div>
							{/if}
						</div>

						<div class="max-h-[60vh] min-h-64 overflow-y-auto rounded-lg border">
							<div class="p-3">
								<div class="space-y-3">
									{#if isExecuting}
										<!-- Show progress for test cases -->
										{#each Array(selectedProblemForSubmission?.testCases?.length || 0) as _, index}
											<div
												class="rounded-lg border p-3 {index < executionResults.length
													? executionResults[index].passed
														? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
														: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
													: index === currentExecutingTestCase
														? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
														: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'}"
											>
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-medium">Test Case {index + 1}</span>
													{#if index < executionResults.length}
														<Badge
															variant={executionResults[index].passed ? 'default' : 'destructive'}
															class="text-xs"
														>
															{executionResults[index].passed ? 'PASSED' : 'FAILED'}
														</Badge>
													{:else if index === currentExecutingTestCase}
														<div class="flex items-center gap-1">
															<div
																class="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
															></div>
															<span class="text-xs text-blue-600">Running...</span>
														</div>
													{:else}
														<Badge variant="outline" class="text-xs">Pending</Badge>
													{/if}
												</div>

												{#if index < executionResults.length}
													<!-- Show completed result -->
													<div class="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Input</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
															>
																{executionResults[index].input}
															</div>
														</div>
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Expected</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
															>
																{executionResults[index].expectedOutput}
															</div>
														</div>
														<div>
															<div class="mb-1 font-medium text-muted-foreground">Your Output</div>
															<div
																class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs {executionResults[
																	index
																].passed
																	? 'text-green-600'
																	: 'text-red-600'}"
															>
																{executionResults[index].actualOutput || 'No output'}
															</div>
														</div>
													</div>

													{#if executionResults[index].error}
														<div class="mt-2">
															<div class="mb-1 text-xs font-medium text-muted-foreground">
																Error
															</div>
															<div
																class="max-h-20 overflow-y-auto rounded border bg-red-100 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
															>
																{executionResults[index].error}
															</div>
														</div>
													{/if}

													<div
														class="mt-2 flex items-center justify-between text-xs text-muted-foreground"
													>
														<span
															>Time: {executionResults[index].executionTime?.toFixed(3) ||
																'0.000'}s</span
														>
														<div class="flex gap-3">
															<span>Memory: {executionResults[index].memory || 0} KB</span>
															{#if executionResults[index].status}
																<span>Status: {executionResults[index].status}</span>
															{/if}
														</div>
													</div>
												{:else if index === currentExecutingTestCase}
													<!-- Show skeleton for currently executing test -->
													<div class="space-y-2">
														<Skeleton class="h-4 w-full" />
														<Skeleton class="h-4 w-3/4" />
														<Skeleton class="h-4 w-1/2" />
													</div>
												{:else}
													<!-- Show placeholder for pending tests -->
													<div class="text-xs text-muted-foreground">Waiting in queue...</div>
												{/if}
											</div>
										{/each}
									{:else}
										<!-- Show completed results -->
										{#each executionResults as result}
											<div
												class="rounded-lg border p-3 {result.passed
													? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
													: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}"
											>
												<div class="mb-2 flex items-center justify-between">
													<span class="text-sm font-medium">Test Case {result.testCaseIndex}</span>
													<Badge
														variant={result.passed ? 'default' : 'destructive'}
														class="text-xs"
													>
														{result.passed ? 'PASSED' : 'FAILED'}
													</Badge>
												</div>

												<div class="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Input</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
														>
															{result.input}
														</div>
													</div>
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Expected</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs"
														>
															{result.expectedOutput}
														</div>
													</div>
													<div>
														<div class="mb-1 font-medium text-muted-foreground">Your Output</div>
														<div
															class="max-h-16 overflow-y-auto rounded border bg-background p-2 font-mono text-xs {result.passed
																? 'text-green-600'
																: 'text-red-600'}"
														>
															{result.actualOutput || 'No output'}
														</div>
													</div>
												</div>

												{#if result.error}
													<div class="mt-2">
														<div class="mb-1 text-xs font-medium text-muted-foreground">Error</div>
														<div
															class="max-h-20 overflow-y-auto rounded border bg-red-100 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
														>
															{result.error}
														</div>
													</div>
												{/if}

												<div
													class="mt-2 flex items-center justify-between text-xs text-muted-foreground"
												>
													<span>Time: {result.executionTime?.toFixed(3) || '0.000'}s</span>
													<div class="flex gap-3">
														<span>Memory: {result.memory || 0} KB</span>
														{#if result.status}
															<span>Status: {result.status}</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									{/if}

									<!-- Summary -->
									{#if !isExecuting && executionResults.length > 0}
										<div class="mt-3 rounded-lg bg-muted p-3">
											<div class="mb-1 text-sm font-medium">
												Results: {executionResults.filter((r) => r.passed)
													.length}/{executionResults.length} tests passed
											</div>
											<div class="text-xs text-muted-foreground">
												{#if executionResults.every((r) => r.passed)}
													🎉 All tests passed! Great job!
												{:else if executionResults.some((r) => r.passed)}
													{executionResults.filter((r) => r.passed).length} tests passed. Keep working
													on the remaining ones!
												{:else}
													No tests passed. Review the errors and try again.
												{/if}
											</div>

											<!-- Overall stats -->
											<div class="mt-2 flex gap-4 text-xs text-muted-foreground">
												<span
													>Avg Time: {(
														executionResults.reduce((sum, r) => sum + (r.executionTime || 0), 0) /
														executionResults.length
													).toFixed(3)}s</span
												>
												<span
													>Max Memory: {Math.max(...executionResults.map((r) => r.memory || 0))} KB</span
												>
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<div class="flex gap-2 pt-6">
			<Button
				variant="outline"
				onclick={() => {
					showSubmissionDialog = false;
					selectedProblemForSubmission = null;
					executionResults = [];
				}}
			>
				Close
			</Button>
			<Button
				onclick={submitCode}
				disabled={isExecuting || !selectedProblemForSubmission || !currentCode.trim()}
			>
				{#if isExecuting}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
					{#if currentExecutingTestCase >= 0}
						Running Test {currentExecutingTestCase + 1}/{selectedProblemForSubmission?.testCases
							?.length || 0}
					{:else}
						Preparing Tests...
					{/if}
				{:else}
					<PlayIcon size={16} class="mr-2" />
					Run Tests ({selectedProblemForSubmission?.testCases?.length || 0})
				{/if}
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>

<!-- End Interview Confirmation Dialog -->
<AlertDialog.Root bind:open={showEndInterviewDialog}>
	<AlertDialog.Content class="max-w-md">
		<AlertDialog.Header>
			<AlertDialog.Title>End Interview & Score Candidate</AlertDialog.Title>
			<AlertDialog.Description class="space-y-4">
				<p>
					You are about to end this interview. Please provide a final score for the candidate's
					performance.
				</p>

				<div class="rounded-lg bg-muted p-3">
					<div class="flex items-center gap-2 text-sm">
						<Clock size={16} />
						<span class="font-medium">Interview Duration:</span>
						<Badge variant="outline" class="font-mono">
							{formatElapsedTime(elapsedTime)}
						</Badge>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="interview-score" class="text-sm font-medium">Final Score (0-100%)</Label>
					<Input
						id="interview-score"
						type="number"
						min="0"
						max="100"
						placeholder="Enter score between 0-100"
						bind:value={interviewScore}
						class="text-center text-lg font-semibold {scoreError ? 'border-destructive' : ''}"
						oninput={() => {
							if (scoreError) scoreError = '';
						}}
					/>
					{#if scoreError}
						<p class="text-xs text-destructive">{scoreError}</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						This score will be saved and visible in the interview history.
					</p>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					interviewScore = '';
					scoreError = '';
				}}>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action
				onclick={endInterview}
				disabled={isEndingInterview || !interviewScore}
				class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
			>
				{#if isEndingInterview}
					<div
						class="border-destructive-foreground mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
					></div>
					Ending Interview...
				{:else}
					<PhoneOff size={16} class="mr-2" />
					End Interview & Save Score
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- AI Chatbot for Interviewers -->
{#if isInterviewer}
	<Sheet.Root bind:open={showChatbot}>
		<Sheet.Content side="right" class="w-full sm:max-w-xl">
			<Sheet.Header>
				<Sheet.Title class="flex items-center gap-2">
					<Bot size={20} class="text-primary" />
					AI Interview Assistant
				</Sheet.Title>
				<Sheet.Description>
					Get real-time assistance and code analysis during the interview.
				</Sheet.Description>
			</Sheet.Header>
			<div class="mt-6">
				<InterviewerChatbot {currentCode} roomId={roomId!} {isTranscriptionEnabled} />
			</div>
		</Sheet.Content>
	</Sheet.Root>
{/if}
