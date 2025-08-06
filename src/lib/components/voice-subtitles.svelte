<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { VoiceTranscriptionService, type TranscriptionResult } from '$lib/voice-transcription';
	import type { ILocalAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
	import { useSession } from '$lib/auth-client';

	interface Props {
		roomId: string;
		localAudioTrack: ILocalAudioTrack | null;
		remoteUsers: IAgoraRTCRemoteUser[];
		isEnabled: boolean;
	}

	let { roomId, localAudioTrack, remoteUsers, isEnabled }: Props = $props();

	const session = useSession();
	const userName = $derived($session.data?.user?.name || 'You');

	// Transcription services
	let localTranscriptionService: VoiceTranscriptionService | null = null;
	let remoteTranscriptionService: VoiceTranscriptionService | null = null;

	// Current subtitles
	let localSubtitle = $state('');
	let remoteSubtitle = $state('');
	let remoteUserName = $state('Other');

	// Subtitle timeout handlers
	let localSubtitleTimeout: ReturnType<typeof setTimeout> | null = null;
	let remoteSubtitleTimeout: ReturnType<typeof setTimeout> | null = null;

	// Fetch remote user info
	const fetchRemoteUserInfo = async () => {
		if (remoteUsers.length > 0) {
			try {
				const res = await fetch(`/api/user/${remoteUsers[0].uid}`);
				if (res.ok) {
					const userData = await res.json();
					remoteUserName = userData.name || 'Other';
				}
			} catch (error) {
				console.error('Failed to fetch remote user info:', error);
			}
		}
	};

	// Handle transcription results with text truncation
	const handleLocalTranscription = (result: TranscriptionResult) => {
		if (result.text && result.text.trim()) {
			const fullText = result.text.trim();
			// Show last 20 characters, add ellipsis if truncated
			localSubtitle = fullText.length > 20 ? '...' + fullText.slice(-20) : fullText;
			if (localSubtitleTimeout) {
				clearTimeout(localSubtitleTimeout);
			}
			localSubtitleTimeout = setTimeout(() => {
				localSubtitle = '';
			}, 3000);
		}
	};

	const handleRemoteTranscription = (result: TranscriptionResult) => {
		if (result.text && result.text.trim()) {
			const fullText = result.text.trim();
			// Show last 20 characters, add ellipsis if truncated
			remoteSubtitle = fullText.length > 20 ? '...' + fullText.slice(-20) : fullText;
			if (remoteSubtitleTimeout) {
				clearTimeout(remoteSubtitleTimeout);
			}
			remoteSubtitleTimeout = setTimeout(() => {
				remoteSubtitle = '';
			}, 3000);
		}
	};	// Start transcription services
	const startTranscription = async () => {
		try {
			// Start local transcription if audio track is available
			if (localAudioTrack) {
				localTranscriptionService = new VoiceTranscriptionService();
				localTranscriptionService.onTranscription(handleLocalTranscription);
				await localTranscriptionService.startLocalTranscription(localAudioTrack, roomId, userName);
				console.log('Local transcription started');
			}

			// Start remote transcription if remote user has audio
			if (remoteUsers.length > 0 && remoteUsers[0].audioTrack) {
				remoteTranscriptionService = new VoiceTranscriptionService();
				remoteTranscriptionService.onTranscription(handleRemoteTranscription);
				await remoteTranscriptionService.startRemoteTranscription(remoteUsers[0], roomId, remoteUserName);
				console.log('Remote transcription started');
			}
		} catch (error) {
			console.error('Failed to start transcription:', error);
		}
	};

	// Stop transcription services
	const stopTranscription = () => {
		if (localTranscriptionService) {
			localTranscriptionService.stop();
			localTranscriptionService = null;
		}
		if (remoteTranscriptionService) {
			remoteTranscriptionService.stop();
			remoteTranscriptionService = null;
		}
		
		// Clear subtitles and timeouts
		localSubtitle = '';
		remoteSubtitle = '';
		if (localSubtitleTimeout) {
			clearTimeout(localSubtitleTimeout);
			localSubtitleTimeout = null;
		}
		if (remoteSubtitleTimeout) {
			clearTimeout(remoteSubtitleTimeout);
			remoteSubtitleTimeout = null;
		}
		
		console.log('Transcription stopped');
	};

	// Watch for enabled state changes
	$effect(() => {
		if (isEnabled) {
			startTranscription();
		} else {
			stopTranscription();
		}
	});

	// Watch for remote user changes
	$effect(() => {
		if (remoteUsers.length > 0) {
			fetchRemoteUserInfo();
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		stopTranscription();
	});
</script>

<!-- Subtitle overlays -->
{#if isEnabled}
	<!-- Local subtitle (yellow) -->
	{#if localSubtitle}
		<div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 max-w-[80%]">
			<div class="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border-l-4 border-yellow-400">
				<div class="text-xs text-yellow-400 mb-1 font-medium">{userName}</div>
				<div class="text-sm text-white leading-tight">{localSubtitle}</div>
			</div>
		</div>
	{/if}

	<!-- Remote subtitle (white) -->
	{#if remoteSubtitle}
		<div class="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 max-w-[80%]">
			<div class="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border-l-4 border-white">
				<div class="text-xs text-gray-300 mb-1 font-medium">{remoteUserName}</div>
				<div class="text-sm text-white leading-tight">{remoteSubtitle}</div>
			</div>
		</div>
	{/if}
{/if}
