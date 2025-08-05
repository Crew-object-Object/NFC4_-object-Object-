<script lang="ts">
	import {
		Mic,
		User,
		Video,
		MicOff,
		VideoOff,
		HelpCircle,
		RefreshCw,
		Shield,
		Eye,
		EyeOff
	} from 'lucide-svelte';
	import type { ILocalAudioTrack, ILocalVideoTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { useSession } from '$lib/auth-client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PUBLIC_AGORA_APP_ID } from '$env/static/public';

	interface Props {
		roomId: string;
	}

	let { roomId }: Props = $props();

	const session = useSession();
	const user = $derived($session.data?.user);
	const userRole = $derived($session.data?.user?.role);
	const isInterviewer = $derived(userRole === 'Interviewer');
	const isInterviewee = $derived(userRole === 'Interviewee');
	const role = $derived(userRole?.toLowerCase());

	let isMuted = $state(false);
	let isJoining = $state(false);
	let isCameraOff = $state(false);
	let remoteMuted = $state(false);
	let remoteCameraOff = $state(false);
	let error = $state<string | null>(null);
	let permissionGranted = $state(false);
	let checkingPermissions = $state(true);
	let permissionError = $state<string | null>(null);
	let video: ILocalVideoTrack | null = null;
	let audio: ILocalAudioTrack | null = null;
	let users: IAgoraRTCRemoteUser[] = $state([]);
	let remoteUserName: string | null = $state(null);
	let remoteUserImage: string | null = $state(null);

	// Eye tracking states
	let isEyeTrackingActive = $state(false);
	let isEyeTrackingInitializing = $state(false);
	let eyeTrackingError = $state<string | null>(null);
	let animationFrameId: number | null = null;
	let faceLandmarker: any = null;
	let lastVideoTime = -1;
	let processingCanvas: HTMLCanvasElement;

	// Cheating detection states - Enhanced for coding interviews and low light
	let isLookingAway = $state(false);
	let lookAwayStartTime = 0;
	let lookAwayThreshold = 3000; // 3 seconds - reduced for better responsiveness
	let headMovementThreshold = 0.2; // More sensitive for lateral movement
	let downwardLookThreshold = 0.3; // Slightly reduced for better detection
	let extremeLookThreshold = 0.3; // More sensitive extreme detection
	let upwardLookThreshold = 0.2; // Detect upward looking more accurately
	let lastNotificationTime = 0;
	let notificationCooldown = 5000; // 5 seconds between notifications
	let consecutiveSuspiciousFrames = 0;
	let requiredSuspiciousFrames = 20; // ~0.7 seconds of consistent behavior
	let recentHeadPositions: Array<{ x: number; y: number; timestamp: number }> = [];
	let maxPositionHistory = 10; // Track last 10 positions for smoothing

	// Baseline measurements (established in first few seconds)
	let baselineHeadPosition = null;
	let baselineEyeDirection = null;
	let calibrationFrames = 0;

	let AgoraRTC: any = null;
	let client: any = null;

	onMount(async () => {
		if (browser) {
			await checkPermissions();
		}
	});

	async function checkPermissions() {
		try {
			// checkingPermissions = true;
			permissionError = null;

			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Your browser does not support camera/microphone access');
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});

			stream.getTracks().forEach((track) => track.stop());

			permissionGranted = true;
			checkingPermissions = false;

			const AgoraModule = await import('agora-rtc-sdk-ng');
			AgoraRTC = AgoraModule.default;
			AgoraRTC.setLogLevel(2);
			client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

			await initializeRoom();
		} catch (err) {
			checkingPermissions = false;
			permissionGranted = false;
			console.error('Permission error:', err);

			if (err instanceof Error) {
				if (err.name === 'NotAllowedError') {
					permissionError =
						'Camera and microphone access denied. Please allow permissions and refresh the page.';
				} else if (err.name === 'NotFoundError') {
					permissionError =
						'No camera or microphone found. Please connect your devices and try again.';
				} else if (err.name === 'NotReadableError') {
					permissionError = 'Camera or microphone is already in use by another application.';
				} else {
					permissionError = err.message;
				}
			} else {
				permissionError = 'Failed to access camera and microphone';
			}
		}
	}

	const renderVideo = (_node: any, user: IAgoraRTCRemoteUser) => {
		user.videoTrack?.play(String(user.uid));
	};

	async function cleanup() {
		try {
			if (isEyeTrackingActive && faceLandmarker) {
				await stopEyeTracking();
			}

			if (video) {
				video.close();
				video = null;
			}

			if (audio) {
				audio.close();
				audio = null;
			}

			if (client) {
				await client.leave();
				client.removeAllListeners();
			}

			users = [];
		} catch (err) {
			console.error('Error during cleanup:', err);
		}
	}

	async function initializeRoom() {
		if (!browser || !client || !permissionGranted) {
			error = 'Cannot initialize room without proper permissions';
			isJoining = false;
			return;
		}

		try {
			isJoining = true;
			error = null;

			if (!roomId) {
				throw new Error('Room ID is required');
			}

			try {
				video = await AgoraRTC.createCameraVideoTrack();
				audio = await AgoraRTC.createMicrophoneAudioTrack();
			} catch (err) {
				throw new Error('Failed to access camera/microphone. Please check your permissions.');
			}

			client.on('user-published', async (user: IAgoraRTCRemoteUser, type: 'video' | 'audio') => {
				try {
					if (type === 'video' || type === 'audio') {
						const existingUser = users.find((u) => u.uid === user.uid);
						if (existingUser) {
							await client.subscribe(user, type);
							if (type === 'video') {
								user.videoTrack?.play(String(user.uid));
								remoteCameraOff = false;
							} else if (type === 'audio') {
								user.audioTrack?.play();
								remoteMuted = false;
							}
							return;
						}

						await client.subscribe(user, type);
						if (type === 'video') {
							user.videoTrack?.play(String(user.uid));
							remoteCameraOff = false;
						} else if (type === 'audio') {
							user.audioTrack?.play();
							remoteMuted = false;
						}

						if (!users.find((u) => u.uid === user.uid)) {
							users = [...users, user];

							try {
								const res = await fetch(`/api/user/${user.uid}`);

								if (res.ok) {
									const remoteUserProfile = await res.json();
									remoteUserImage = remoteUserProfile.image;
									remoteUserName = remoteUserProfile.name;
								}
							} catch (e) {
								remoteUserImage = null;
								remoteUserName = null;
							}
						}
					}
				} catch (err) {
					console.error('Error handling user-published event:', err);
					error = 'Failed to connect with new participant';
				}
			});

			client.on('user-unpublished', (user: IAgoraRTCRemoteUser, type: 'video' | 'audio') => {
				if (type === 'video') {
					remoteCameraOff = true;
				} else if (type === 'audio') {
					remoteMuted = true;
				}
			});

			client.on('user-left', (user: IAgoraRTCRemoteUser) => {
				users = users.filter((u) => u.uid !== user.uid);

				if (isEyeTrackingActive && users.length === 0) {
					stopEyeTracking();
				}
			});

			client.on('connection-state-change', (curState: string) => {
				if (curState === 'DISCONNECTED') {
					error = 'Connection lost. Please try rejoining the room.';
				} else if (curState === 'RECONNECTING') {
					toast.info('Reconnecting...');
				} else if (curState === 'CONNECTED') {
					error = null;
				}
			});

			client.on('token-privilege-will-expire', async () => {
				try {
					const uid = user?.id
						? parseInt(user.id.replace(/\D/g, '')) || Math.floor(Math.random() * 100000)
						: Math.floor(Math.random() * 100000);
					const tokenResponse = await fetch('/api/agora-token', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ uid, channelName: roomId })
					});

					if (tokenResponse.ok) {
						const { token } = await tokenResponse.json();
						await client.renewToken(token);
						toast.success('Token renewed successfully');
					}
				} catch (err) {
					console.error('Failed to renew token:', err);
					error = 'Token expired. Please rejoin the room.';
				}
			});

			client.on('token-privilege-did-expire', async () => {
				error = 'Session expired. Please rejoin the room.';
				await cleanup();
			});

			let retryCount = 0;
			const maxRetries = 3;

			while (retryCount < maxRetries) {
				try {
					const uid = user?.id
						? parseInt(user.id.replace(/\D/g, '')) || Math.floor(Math.random() * 100000)
						: Math.floor(Math.random() * 100000);
					const tokenResponse = await fetch('/api/agora-token', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ uid, channelName: roomId })
					});

					if (!tokenResponse.ok) {
						const errorData = await tokenResponse.json();
						throw new Error(errorData.error || 'Failed to get token');
					}

					const { token } = await tokenResponse.json();

					await client.join(PUBLIC_AGORA_APP_ID, roomId, token, uid);

					if (client.connectionState === 'CONNECTED') {
						await client.publish([video, audio]);
						isJoining = false;
						error = null;
						toast.success('Connected successfully');
						break;
					} else {
						throw new Error('Connection failed to establish');
					}
				} catch (err) {
					retryCount++;
					console.error(`Connection attempt ${retryCount} failed:`, err);

					try {
						if (client && client.connectionState !== 'DISCONNECTED') {
							await client.leave();
						}
					} catch (cleanupErr) {
						console.error('Cleanup error:', cleanupErr);
					}

					if (retryCount === maxRetries) {
						throw new Error(
							`Failed to join room after ${maxRetries} attempts. Please check your internet connection and try again.`
						);
					}

					toast.info(`Connection attempt ${retryCount} failed, retrying...`);
					await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
				}
			}
		} catch (err) {
			console.error('Error initializing room:', err);
			await cleanup();
			isJoining = false;

			if (err instanceof Error) {
				if (err.message.includes('WebSocket') || err.message.includes('network')) {
					error = 'Network connection failed. Please check your internet connection and try again.';
				} else if (err.message.includes('token') || err.message.includes('privilege')) {
					error = 'Authentication failed. Please refresh the page and try again.';
				} else {
					error = err.message;
				}
			} else {
				error = 'An unexpected error occurred while joining the room';
			}
		}
	}

	function toggleCamera() {
		try {
			if (video && client && client.connectionState === 'CONNECTED') {
				isCameraOff = !isCameraOff;
				if (isCameraOff) {
					client.unpublish([video]);
				} else {
					client.publish([video]);
				}
			} else if (!client || client.connectionState !== 'CONNECTED') {
				error = 'Cannot toggle camera: not connected to room';
			}
		} catch (err) {
			console.error('Error toggling camera:', err);
			error = 'Failed to toggle camera. Please try again.';
		}
	}

	function toggleMute() {
		try {
			if (audio && client && client.connectionState === 'CONNECTED') {
				isMuted = !isMuted;
				if (isMuted) {
					client.unpublish([audio]);
				} else {
					client.publish([audio]);
				}
			} else if (!client || client.connectionState !== 'CONNECTED') {
				error = 'Cannot toggle microphone: not connected to room';
			}
		} catch (err) {
			console.error('Error toggling mute:', err);
			error = 'Failed to toggle microphone. Please try again.';
		}
	}

	async function retryConnection() {
		error = null;
		permissionError = null;
		checkingPermissions = false;
		permissionGranted = false;
		await checkPermissions();
	}

	// Eye tracking functions
	async function startEyeTracking() {
		console.log('startEyeTracking called');
		console.log('isInterviewer:', isInterviewer);
		console.log('users.length:', users.length);
		console.log('remoteCameraOff:', remoteCameraOff);

		if (!isInterviewer || users.length === 0) {
			toast.error('Eye tracking is only available for interviewers when an interviewee is present');
			return;
		}

		if (remoteCameraOff) {
			toast.error("Cannot start eye tracking while the interviewee's camera is off");
			return;
		}

		try {
			isEyeTrackingInitializing = true;
			eyeTrackingError = null;

			// Get the remote video element
			const remoteUser = users[0];
			console.log('Remote user:', remoteUser);

			// Wait for video element to be available
			let remoteVideoElement: HTMLVideoElement | null = null;
			let attempts = 0;
			const maxAttempts = 20;

			while (!remoteVideoElement && attempts < maxAttempts) {
				const containerElement = document.getElementById(String(remoteUser.uid));
				if (containerElement) {
					// Look for video element inside the container
					const videoElement = containerElement.querySelector('video') as HTMLVideoElement;
					if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
						remoteVideoElement = videoElement;
						console.log('Found video element inside container');
					} else {
						console.log(`Attempt ${attempts + 1}: Video element not ready, waiting...`);
						await new Promise((resolve) => setTimeout(resolve, 100));
						attempts++;
					}
				} else {
					console.log(`Attempt ${attempts + 1}: Container not found, waiting...`);
					await new Promise((resolve) => setTimeout(resolve, 100));
					attempts++;
				}
			}

			console.log('Remote video element:', remoteVideoElement);
			if (remoteVideoElement) {
				console.log('Video element properties:', {
					videoWidth: remoteVideoElement.videoWidth,
					videoHeight: remoteVideoElement.videoHeight,
					currentTime: remoteVideoElement.currentTime,
					readyState: remoteVideoElement.readyState
				});
			}

			if (!remoteVideoElement) {
				throw new Error('Remote video element not found after waiting');
			}

			// Load MediaPipe Face Landmarker
			console.log('Loading MediaPipe library...');
			await loadMediaPipeLibrary();

			if (!faceLandmarker) {
				throw new Error('Failed to initialize MediaPipe Face Landmarker');
			}

			// Reset tracking state for enhanced coding interview detection
			baselineHeadPosition = null;
			baselineEyeDirection = null;
			calibrationFrames = 0;
			isLookingAway = false;
			lookAwayStartTime = 0;
			lastNotificationTime = 0;
			consecutiveSuspiciousFrames = 0;
			recentHeadPositions = [];

			// Set tracking active BEFORE starting the loop
			isEyeTrackingActive = true;

			console.log('Starting face tracking...');
			// Start face tracking loop
			startFaceTracking(remoteVideoElement);

			isEyeTrackingInitializing = false;
			toast.success('Eye tracking started - monitoring for cheating behavior');
			console.log('Eye tracking started successfully');
		} catch (err) {
			console.error('Error starting eye tracking:', err);
			isEyeTrackingInitializing = false;
			eyeTrackingError = err instanceof Error ? err.message : 'Failed to start eye tracking';
			toast.error('Failed to start eye tracking');
		}
	}

	async function loadMediaPipeLibrary() {
		try {
			// Use the installed MediaPipe Tasks Vision instead of CDN
			const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');

			console.log('Loading MediaPipe Vision Tasks...');

			// Initialize the vision tasks
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
			);

			console.log('Creating Face Landmarker...');

			// Create face landmarker
			faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
					delegate: 'GPU'
				},
				runningMode: 'VIDEO',
				outputFaceBlendshapes: false,
				outputFacialTransformationMatrixes: false,
				numFaces: 1
			});

			console.log('MediaPipe Face Landmarker loaded successfully');
		} catch (error) {
			console.error('Failed to load MediaPipe:', error);
			throw new Error('Failed to load MediaPipe library');
		}
	}

	function startFaceTracking(videoElement: HTMLVideoElement) {
		if (!faceLandmarker) {
			console.log('No faceLandmarker available');
			return;
		}

		console.log('Starting face tracking with video element:', videoElement);
		console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
		console.log('isEyeTrackingActive at start:', isEyeTrackingActive);

		function detectFace() {
			if (!isEyeTrackingActive || !faceLandmarker) {
				console.log(
					'Eye tracking inactive or no faceLandmarker. Active:',
					isEyeTrackingActive,
					'Landmarker:',
					!!faceLandmarker
				);
				return;
			}

			const currentTime = videoElement.currentTime;
			if (
				currentTime !== lastVideoTime &&
				videoElement.videoWidth > 0 &&
				videoElement.videoHeight > 0
			) {
				lastVideoTime = currentTime;
				console.log('🎬 Processing video frame at time:', currentTime.toFixed(3));

				try {
					// Use the new MediaPipe Tasks API
					const results = faceLandmarker.detectForVideo(videoElement, Date.now());
					console.log('🔄 MediaPipe results received:', results);

					if (results.faceLandmarks && results.faceLandmarks.length > 0) {
						console.log('✅ Face landmarks detected, processing...');
						processFaceLandmarks(results.faceLandmarks[0]);
					} else {
						console.log('❌ No face landmarks in results');
					}
				} catch (error) {
					console.error('Face detection error:', error);
				}
			}

			// Continue the loop every frame
			animationFrameId = requestAnimationFrame(detectFace);
		}

		console.log('🚀 Starting detection loop with isEyeTrackingActive:', isEyeTrackingActive);
		detectFace();
	}

	function processFaceLandmarks(landmarks: any[]) {
		console.log('🔍 Face landmarks detected at', new Date().toLocaleTimeString());
		console.log('📊 Total landmarks count:', landmarks ? landmarks.length : 'null');

		if (!landmarks || landmarks.length === 0) {
			console.log('❌ No landmarks detected');
			return;
		}

		// Use the new vector-based approach with landmarks 1, 4, and 5
		const point1 = landmarks[1]; // Nose tip upper
		const point4 = landmarks[4]; // Nose tip lower  
		const point5 = landmarks[5]; // Nose base

		if (!point1 || !point4 || !point5) {
			console.log('❌ Required landmarks (1, 4, 5) not found');
			return;
		}

		// Calculate midpoint between landmarks 1 and 5
		const midpoint = {
			x: (point1.x + point5.x) / 2,
			y: (point1.y + point5.y) / 2,
			z: (point1.z + point5.z) / 2
		};

		// Create vector from midpoint to point 4
		const gazeVector = {
			x: point4.x - midpoint.x,
			y: point4.y - midpoint.y,
			z: point4.z - midpoint.z
		};

		// Calculate vector magnitude for normalization
		const vectorMagnitude = Math.sqrt(
			gazeVector.x * gazeVector.x + 
			gazeVector.y * gazeVector.y + 
			gazeVector.z * gazeVector.z
		);

		// Normalize the vector
		const normalizedVector = {
			x: gazeVector.x / vectorMagnitude,
			y: gazeVector.y / vectorMagnitude,
			z: gazeVector.z / vectorMagnitude
		};

		console.log('🎯 Gaze vector analysis:', {
			midpoint: { x: midpoint.x.toFixed(4), y: midpoint.y.toFixed(4), z: midpoint.z.toFixed(4) },
			point4: { x: point4.x.toFixed(4), y: point4.y.toFixed(4), z: point4.z.toFixed(4) },
			rawVector: { x: gazeVector.x.toFixed(4), y: gazeVector.y.toFixed(4), z: gazeVector.z.toFixed(4) },
			normalizedVector: { x: normalizedVector.x.toFixed(4), y: normalizedVector.y.toFixed(4), z: normalizedVector.z.toFixed(4) },
			magnitude: vectorMagnitude.toFixed(4)
		});

		// Add to position history for smoothing
		const currentTime = Date.now();
		recentHeadPositions.push({
			x: normalizedVector.x,
			y: normalizedVector.y,
			timestamp: currentTime
		});

		// Keep only recent positions (last 500ms)
		recentHeadPositions = recentHeadPositions.filter((pos) => currentTime - pos.timestamp < 500);

		// Calculate smoothed vector using recent history
		const smoothedVector = {
			x: recentHeadPositions.reduce((sum, pos) => sum + pos.x, 0) / recentHeadPositions.length,
			y: recentHeadPositions.reduce((sum, pos) => sum + pos.y, 0) / recentHeadPositions.length
		};

		// Define thresholds for acceptable gaze direction
		const lateralThreshold = 0.15; // Threshold for left/right movement
		const upwardThreshold = 0.1;   // Threshold for upward movement (more sensitive)
		const downwardThreshold = 0.25; // Threshold for downward movement (keyboard area)
		const extremeThreshold = 0.3;   // Threshold for extreme movements

		// Analyze gaze direction based on normalized vector components
		const isLookingTooFarLeft = smoothedVector.x < -lateralThreshold;
		const isLookingTooFarRight = smoothedVector.x > lateralThreshold;
		const isLookingTooFarUp = smoothedVector.y < -upwardThreshold;
		const isLookingTooFarDown = smoothedVector.y > downwardThreshold;
		
		// Extreme movements (clearly away from screen/keyboard area)
		const isLookingExtremeLeft = smoothedVector.x < -extremeThreshold;
		const isLookingExtremeRight = smoothedVector.x > extremeThreshold;
		const isLookingExtremeUp = smoothedVector.y < -extremeThreshold;
		const isLookingExtremeDown = smoothedVector.y > extremeThreshold + 0.2;

		// Calculate movement velocity for rapid head turns
		const movementVelocity =
			recentHeadPositions.length >= 2
				? Math.sqrt(
						Math.pow(
							recentHeadPositions[recentHeadPositions.length - 1].x - recentHeadPositions[0].x,
							2
						) +
							Math.pow(
								recentHeadPositions[recentHeadPositions.length - 1].y - recentHeadPositions[0].y,
								2
							)
					)
				: 0;

		const isRapidMovement = movementVelocity > 0.2; // Detect quick head turns

		// Determine suspicious behavior based on vector analysis
		const isSuspiciousBehavior =
			isLookingExtremeLeft ||
			isLookingExtremeRight ||
			isLookingExtremeUp ||
			isLookingExtremeDown ||
			isLookingTooFarLeft ||
			isLookingTooFarRight ||
			isLookingTooFarUp ||
			isRapidMovement;

		console.log('📊 Vector-based gaze analysis:', {
			smoothedVector: { x: smoothedVector.x.toFixed(4), y: smoothedVector.y.toFixed(4) },
			velocity: movementVelocity.toFixed(4),
			lookingTooFarLeft: isLookingTooFarLeft,
			lookingTooFarRight: isLookingTooFarRight,
			lookingTooFarUp: isLookingTooFarUp,
			lookingTooFarDown: isLookingTooFarDown,
			lookingExtremeLeft: isLookingExtremeLeft,
			lookingExtremeRight: isLookingExtremeRight,
			lookingExtremeUp: isLookingExtremeUp,
			lookingExtremeDown: isLookingExtremeDown,
			rapidMovement: isRapidMovement,
			isSuspiciousBehavior,
			consecutiveFrames: consecutiveSuspiciousFrames
		});

		if (isSuspiciousBehavior) {
			consecutiveSuspiciousFrames++;

			// Start timing after fewer consistent frames for better responsiveness
			if (consecutiveSuspiciousFrames >= requiredSuspiciousFrames) {
				if (!isLookingAway) {
					isLookingAway = true;
					lookAwayStartTime = Date.now();
					console.log('🚨 Started tracking suspicious behavior');
				} else {
					const currentTime = Date.now();
					const duration = currentTime - lookAwayStartTime;

					// Notify after shorter duration for better detection
					if (
						duration > lookAwayThreshold &&
						currentTime - lastNotificationTime > notificationCooldown
					) {
						let behaviorType = '';
						let severity = '';

						if (isRapidMovement) {
							behaviorType = 'rapid head movement';
							severity = 'HIGH';
						} else if (isLookingExtremeLeft) {
							behaviorType = 'looking far left (potential second screen)';
							severity = 'HIGH';
						} else if (isLookingExtremeRight) {
							behaviorType = 'looking far right (potential second screen)';
							severity = 'HIGH';
						} else if (isLookingExtremeUp) {
							behaviorType = 'looking upward (potential notes/ceiling)';
							severity = 'HIGH';
						} else if (isLookingExtremeDown) {
							behaviorType = 'looking too far down (beyond keyboard)';
							severity = 'MEDIUM';
						} else if (isLookingTooFarLeft) {
							behaviorType = 'looking left of screen';
							severity = 'MEDIUM';
						} else if (isLookingTooFarRight) {
							behaviorType = 'looking right of screen';
							severity = 'MEDIUM';
						} else if (isLookingTooFarUp) {
							behaviorType = 'looking above screen';
							severity = 'MEDIUM';
						}

						// Enhanced toast messages with better context
						if (severity === 'HIGH') {
							toast.error(
								`🚨 CRITICAL: Candidate ${behaviorType} for ${(duration / 1000).toFixed(1)}s`
							);
						} else if (severity === 'MEDIUM') {
							toast.warning(
								`⚠️ SUSPICIOUS: Candidate ${behaviorType} for ${(duration / 1000).toFixed(1)}s`
							);
						} else {
							toast.info(
								`ℹ️ MONITORING: Prolonged ${behaviorType} - ${(duration / 1000).toFixed(1)}s`
							);
						}

						console.log(`🚨 ${severity} behavior detected: ${behaviorType}`, {
							duration: duration / 1000,
							vectorComponents: smoothedVector,
							velocity: movementVelocity,
							consecutiveFrames: consecutiveSuspiciousFrames
						});

						lastNotificationTime = currentTime;
					}
				}
			}
		} else {
			// Reset counters when behavior returns to normal
			if (consecutiveSuspiciousFrames > 0) {
				console.log(
					`✅ Gaze returned to acceptable range after ${consecutiveSuspiciousFrames} suspicious frames`
				);
			}
			consecutiveSuspiciousFrames = 0;
			isLookingAway = false;
			lookAwayStartTime = 0;
		}
	}

	async function stopEyeTracking() {
		try {
			// Stop animation frame
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}

			// Reset tracking data for enhanced detection
			baselineHeadPosition = null;
			baselineEyeDirection = null;
			calibrationFrames = 0;
			isLookingAway = false;
			lookAwayStartTime = 0;
			lastNotificationTime = 0;
			consecutiveSuspiciousFrames = 0;
			recentHeadPositions = [];

			isEyeTrackingActive = false;
			eyeTrackingError = null;
			toast.success('Eye tracking stopped');
		} catch (err) {
			console.error('Error stopping eye tracking:', err);
			toast.error('Error stopping eye tracking');
		}
	}

	onMount(() => {
		// Permissions will be checked in onMount
	});

	onDestroy(() => {
		cleanup();
	});
</script>

<div class="relative flex h-full w-full flex-col bg-background">
	{#if checkingPermissions}
		<div class="flex h-full items-center justify-center p-8">
			<Card.Root class="w-full max-w-md">
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<Shield class="h-8 w-8 animate-pulse text-primary" />
					</div>
					<Card.Title>Requesting Permissions</Card.Title>
					<Card.Description>
						{#if isInterviewer}
							Please allow camera and microphone access to conduct the interview
						{:else if isInterviewee}
							Please allow camera and microphone access to join the interview
						{:else}
							Please allow camera and microphone access to join the call
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-3">
						<div class="flex items-center gap-3">
							<Skeleton class="h-4 w-4 rounded-full" />
							<Skeleton class="h-4 flex-1" />
						</div>
						<div class="flex items-center gap-3">
							<Skeleton class="h-4 w-4 rounded-full" />
							<Skeleton class="h-4 flex-1" />
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{:else if permissionError}
		<div class="flex h-full items-center justify-center p-8">
			<Card.Root class="w-full max-w-md border-destructive/20">
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<HelpCircle class="h-8 w-8 text-destructive" />
					</div>
					<Card.Title class="text-destructive">Permission Required</Card.Title>
					<Card.Description>{permissionError}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button onclick={retryConnection} class="w-full">
						<RefreshCw class="mr-2 h-4 w-4" />
						Try Again
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
	{:else if isJoining}
		<div class="flex h-full items-center justify-center p-8">
			<Card.Root class="w-full max-w-md">
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
					>
						<div
							class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
						></div>
					</div>
					<Card.Title>
						{#if isInterviewer}
							Starting Interview
						{:else if isInterviewee}
							Joining Interview
						{:else}
							Joining Room
						{/if}
					</Card.Title>
					<Card.Description>Connecting to {roomId}...</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="space-y-3">
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-4 w-1/2" />
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{:else if error}
		<div class="flex h-full items-center justify-center p-8">
			<Card.Root class="w-full max-w-md border-destructive/20">
				<Card.Header class="text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
					>
						<HelpCircle class="h-8 w-8 text-destructive" />
					</div>
					<Card.Title class="text-destructive">Connection Failed</Card.Title>
					<Card.Description>{error}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button onclick={initializeRoom} class="w-full">
						<RefreshCw class="mr-2 h-4 w-4" />
						Try Again
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
	{:else}
		<div class="relative h-full w-full">
			{#if users.length > 0}
				{@const remoteUser = users[0]}
				<!-- Full screen video container -->
				<div class="absolute inset-0 overflow-hidden bg-black">
					{#if remoteCameraOff}
						<div
							class="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800"
						>
							<div class="flex flex-col items-center gap-6 text-center">
								<div
									class="flex h-24 w-24 items-center justify-center rounded-full bg-slate-700/50 ring-4 ring-slate-600/30"
								>
									{#if remoteUserImage}
										<img
											src={remoteUserImage}
											alt={remoteUserName ?? 'Participant'}
											class="h-full w-full rounded-full object-cover"
										/>
									{:else}
										<User class="h-12 w-12 text-slate-400" />
									{/if}
								</div>
								<div>
									<h3 class="text-xl font-semibold text-white">
										{#if remoteUserName}
											{remoteUserName}
											{#if isInterviewer}
												<span class="text-sm text-slate-300">(Candidate)</span>
											{:else if isInterviewee}
												<span class="text-sm text-slate-300">(Interviewer)</span>
											{/if}
										{:else if isInterviewer}
											Candidate
										{:else if isInterviewee}
											Interviewer
										{:else}
											Participant
										{/if}
									</h3>
									<p class="text-sm text-slate-400">Camera is off</p>
								</div>
							</div>
						</div>
					{:else}
						<div class="h-full w-full">
							<div
								id={String(remoteUser.uid)}
								use:renderVideo={remoteUser}
								class="h-full w-full"
							></div>
						</div>
					{/if}

					<!-- User name overlay -->
					<div class="absolute bottom-12 left-4">
						<div class="rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
							<span class="text-sm font-medium text-white">
								{#if remoteUserName}
									{remoteUserName}
									{#if isInterviewer}
										<span class="ml-1 text-xs text-slate-300">(Candidate)</span>
									{:else if isInterviewee}
										<span class="ml-1 text-xs text-slate-300">(Interviewer)</span>
									{/if}
								{:else if isInterviewer}
									Candidate
								{:else if isInterviewee}
									Interviewer
								{:else}
									Participant
								{/if}
							</span>
						</div>
					</div>

					<!-- Remote muted indicator -->
					{#if remoteMuted}
						<div class="absolute top-6 right-6">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 backdrop-blur-sm"
							>
								<MicOff class="h-5 w-5 text-white" />
							</div>
						</div>
					{/if}

					<!-- Eye tracking error overlay -->
					{#if eyeTrackingError}
						<div class="absolute top-6 left-6">
							<div class="rounded-lg bg-red-500/90 px-3 py-2 backdrop-blur-sm">
								<span class="text-sm text-white">Eye tracking error: {eyeTrackingError}</span>
							</div>
						</div>
					{/if}

					<!-- Eye tracking active indicator -->
					{#if isEyeTrackingActive && isInterviewer}
						<div class="absolute top-6 left-6">
							<div class="rounded-lg bg-blue-500/90 px-3 py-2 backdrop-blur-sm">
								<span class="flex items-center gap-2 text-sm text-white">
									<div class="h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
									Face Tracking Active
								</span>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Full screen waiting state -->
				<div
					class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
				>
					<div class="flex flex-col items-center gap-6 text-center">
						<div
							class="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200 ring-4 ring-slate-300/30 dark:bg-slate-700 dark:ring-slate-600/30"
						>
							<Video class="h-12 w-12 text-slate-500 dark:text-slate-400" />
						</div>
						<div>
							<h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100">
								{#if isInterviewer}
									Waiting for interviewee
								{:else if isInterviewee}
									Waiting for interviewer
								{:else}
									Waiting for participant
								{/if}
							</h3>
							<p class="text-sm text-slate-600 dark:text-slate-400">
								{#if isInterviewer}
									Share room ID with the candidate: <code
										class="rounded bg-slate-200 px-2 py-1 font-mono text-xs dark:bg-slate-700"
										>{roomId}</code
									>
								{:else}
									Connected to room: <code
										class="rounded bg-slate-200 px-2 py-1 font-mono text-xs dark:bg-slate-700"
										>{roomId}</code
									>
								{/if}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Floating controls overlay at bottom -->
			<div class="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transform">
				<div
					class="flex items-center justify-center gap-2 rounded-full bg-black/70 px-3 py-2 backdrop-blur-md"
				>
					<Button
						size="sm"
						variant={isCameraOff ? 'destructive' : 'default'}
						onclick={toggleCamera}
						class="h-8 w-8 rounded-full p-0"
						title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
					>
						{#if isCameraOff}
							<VideoOff class="h-4 w-4" />
						{:else}
							<Video class="h-4 w-4" />
						{/if}
					</Button>

					<Button
						size="sm"
						variant={isMuted ? 'destructive' : 'default'}
						onclick={toggleMute}
						class="h-8 w-8 rounded-full p-0"
						title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
					>
						{#if isMuted}
							<MicOff class="h-4 w-4" />
						{:else}
							<Mic class="h-4 w-4" />
						{/if}
					</Button>

					{#if role === 'interviewer'}
						<Button
							size="sm"
							variant={isEyeTrackingActive ? 'secondary' : 'outline'}
							onclick={isEyeTrackingActive ? stopEyeTracking : startEyeTracking}
							class="h-8 w-8 rounded-full p-0"
							title={isEyeTrackingActive ? 'Stop Eye Tracking' : 'Start Eye Tracking'}
						>
							{#if isEyeTrackingActive}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Hidden canvas for MediaPipe processing -->
	<canvas bind:this={processingCanvas} class="hidden" width="640" height="480"></canvas>
</div>

// ...existing code...

<style>
	/* Eye tracking overlay styling */
	:global(.eye-tracking-overlay) {
		position: absolute !important;
		pointer-events: none !important;
		z-index: 10 !important;
	}

	/* Prevent picture-in-picture */
	:global(video::-webkit-media-controls-picture-in-picture-button) {
		display: none !important;
	}

	/* Hidden elements */
	.hidden {
		display: none !important;
	}

	/* Calibration progress bar */
	.calibration-progress {
		transition: width 0.3s ease-in-out;
	}
</style>
