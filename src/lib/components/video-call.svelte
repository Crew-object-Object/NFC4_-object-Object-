<script lang="ts">
	import { Mic, User, Video, MicOff, VideoOff, HelpCircle, RefreshCw, Shield } from 'lucide-svelte';
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

	let AgoraRTC: any = null;
	let client: any = null;

	onMount(async () => {
		if (browser) {
			await checkPermissions();
		}
	});

	async function checkPermissions() {
		try {
			checkingPermissions = true;
			permissionError = null;

			// Check if browser supports media devices
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Your browser does not support camera/microphone access');
			}

			// Request permissions
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true
			});

			// Stop the test stream
			stream.getTracks().forEach((track) => track.stop());

			permissionGranted = true;
			checkingPermissions = false;

			// Initialize Agora after permissions are granted
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

					// Clean up current connection attempt before retrying
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

	async function endCall() {
		await cleanup();
		toast.success('Call ended');
	}

	async function retryConnection() {
		error = null;
		permissionError = null;
		checkingPermissions = false;
		permissionGranted = false;
		await checkPermissions();
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
		<div class="relative flex h-full flex-col">
			{#if users.length > 0}
				{@const remoteUser = users[0]}
				<div class="relative flex-1 overflow-hidden bg-black">
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
						<div
							id={String(remoteUser.uid)}
							use:renderVideo={remoteUser}
							class="h-full w-full"
						></div>
						<div class="absolute bottom-6 left-6">
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
					{/if}

					{#if remoteMuted}
						<div class="absolute top-6 right-6">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 backdrop-blur-sm"
							>
								<MicOff class="h-5 w-5 text-white" />
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div
					class="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
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

			<div class="border-t bg-background/95 backdrop-blur-sm">
				<div class="flex items-center justify-center gap-4 p-6">
					<Button
						size="lg"
						variant={isCameraOff ? 'destructive' : 'default'}
						onclick={toggleCamera}
						class="h-14 w-14 rounded-full"
						title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
					>
						{#if isCameraOff}
							<VideoOff class="h-6 w-6" />
						{:else}
							<Video class="h-6 w-6" />
						{/if}
					</Button>

					<Button
						size="lg"
						variant={isMuted ? 'destructive' : 'default'}
						onclick={toggleMute}
						class="h-14 w-14 rounded-full"
						title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
					>
						{#if isMuted}
							<MicOff class="h-6 w-6" />
						{:else}
							<Mic class="h-6 w-6" />
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	#local-video,
	[id^='agora-'] {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: inherit;
	}
</style>
