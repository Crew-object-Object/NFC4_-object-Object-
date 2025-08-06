<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Mic, MicOff, Volume2, VolumeX, Download, Copy, Trash2 } from 'lucide-svelte';
	import { VoiceTranscriptionService, type TranscriptionResult } from '$lib/voice-transcription';
	import type { ILocalAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
	import { toast } from 'svelte-sonner';
	import { useSession } from '$lib/auth-client';

	interface Props {
		roomId: string;
		localAudioTrack: ILocalAudioTrack | null;
		remoteUsers: IAgoraRTCRemoteUser[];
		isInterviewer: boolean;
	}

	let { roomId, localAudioTrack, remoteUsers, isInterviewer }: Props = $props();

	const session = useSession();
	const userName = $derived($session.data?.user?.name || 'Unknown User');

	// Transcription state
	let isLocalTranscriptionActive = $state(false);
	let isRemoteTranscriptionActive = $state(false);
	let transcriptionError = $state<string | null>(null);
	let connectionStatus = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');

	// Transcription data
	interface TranscriptionEntry {
		id: string;
		timestamp: Date;
		text: string;
		speaker: 'local' | 'remote';
		speakerName: string;
	}

	let transcriptionHistory = $state<TranscriptionEntry[]>([]);
	let currentLocalTranscript = $state('');
	let currentRemoteTranscript = $state('');

	// Multiple transcription service instances for local and remote
	let localTranscriptionService: VoiceTranscriptionService | null = null;
	let remoteTranscriptionService: VoiceTranscriptionService | null = null;

	// Remote user info
	let remoteUserName = $state('Remote User');

	// Derived state
	const hasLocalAudio = $derived(localAudioTrack !== null);
	const hasRemoteAudio = $derived(remoteUsers.length > 0 && remoteUsers[0]?.audioTrack);
	const isTranscribing = $derived(isLocalTranscriptionActive || isRemoteTranscriptionActive);

	// Fetch remote user info
	const fetchRemoteUserInfo = async () => {
		if (remoteUsers.length > 0) {
			try {
				const res = await fetch(`/api/user/${remoteUsers[0].uid}`);
				if (res.ok) {
					const userData = await res.json();
					remoteUserName = userData.name || 'Remote User';
				}
			} catch (error) {
				console.error('Failed to fetch remote user info:', error);
			}
		}
	};

	// Handle transcription results
	const handleTranscription = (result: TranscriptionResult, speaker: 'local' | 'remote') => {
		if (!result.text) return;

		const speakerName = speaker === 'local' ? userName : remoteUserName;
		
		// Update current transcript
		if (speaker === 'local') {
			currentLocalTranscript = result.text;
		} else {
			currentRemoteTranscript = result.text;
		}

		// Add to history if it's a complete segment
		if (result.segments && result.segments.length > 0) {
			const entry: TranscriptionEntry = {
				id: `${Date.now()}-${speaker}`,
				timestamp: new Date(),
				text: result.text,
				speaker,
				speakerName
			};
			
			// Avoid duplicates by checking if this text was already added recently
			const recentEntry = transcriptionHistory.find(
				h => h.speaker === speaker && 
				h.text === result.text && 
				Date.now() - h.timestamp.getTime() < 2000
			);
			
			if (!recentEntry) {
				transcriptionHistory = [...transcriptionHistory, entry];
			}
		}
	};

	// Start local transcription
	const startLocalTranscription = async () => {
		if (!localAudioTrack || !hasLocalAudio) {
			toast.error('No local audio track available');
			return;
		}

		try {
			connectionStatus = 'connecting';
			transcriptionError = null;

			// Create new service instance for local audio
			if (!localTranscriptionService) {
				localTranscriptionService = new (await import('$lib/voice-transcription')).VoiceTranscriptionService();
				
				// Setup event handlers for local transcription
				localTranscriptionService.onTranscription((result) => {
					handleTranscription(result, 'local');
				});
			}

			await localTranscriptionService.startLocalTranscription(localAudioTrack, roomId);
			
			isLocalTranscriptionActive = true;
			connectionStatus = 'connected';
			toast.success('Local voice transcription started');
		} catch (error) {
			console.error('Failed to start local transcription:', error);
			connectionStatus = 'disconnected';
			transcriptionError = 'Failed to start local transcription';
			toast.error('Failed to start local transcription');
		}
	};

	// Start remote transcription
	const startRemoteTranscription = async () => {
		if (!hasRemoteAudio || remoteUsers.length === 0) {
			toast.error('No remote audio available');
			return;
		}

		try {
			connectionStatus = 'connecting';
			transcriptionError = null;

			// Create new service instance for remote audio
			if (!remoteTranscriptionService) {
				remoteTranscriptionService = new (await import('$lib/voice-transcription')).VoiceTranscriptionService();
				
				// Setup event handlers for remote transcription
				remoteTranscriptionService.onTranscription((result) => {
					handleTranscription(result, 'remote');
				});
			}

			await remoteTranscriptionService.startRemoteTranscription(remoteUsers[0], roomId);
			
			isRemoteTranscriptionActive = true;
			connectionStatus = 'connected';
			toast.success('Remote voice transcription started');
		} catch (error) {
			console.error('Failed to start remote transcription:', error);
			connectionStatus = 'disconnected';
			transcriptionError = 'Failed to start remote transcription';
			toast.error('Failed to start remote transcription');
		}
	};

	// Stop transcription
	const stopTranscription = () => {
		if (localTranscriptionService) {
			localTranscriptionService.stop();
			localTranscriptionService = null;
		}
		if (remoteTranscriptionService) {
			remoteTranscriptionService.stop();
			remoteTranscriptionService = null;
		}
		
		isLocalTranscriptionActive = false;
		isRemoteTranscriptionActive = false;
		connectionStatus = 'disconnected';
		currentLocalTranscript = '';
		currentRemoteTranscript = '';
		toast.info('Voice transcription stopped');
	};

	// Clear transcription history
	const clearHistory = () => {
		transcriptionHistory = [];
		currentLocalTranscript = '';
		currentRemoteTranscript = '';
		toast.info('Transcription history cleared');
	};

	// Copy transcript to clipboard
	const copyTranscript = async () => {
		const fullTranscript = transcriptionHistory
			.map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${entry.speakerName}: ${entry.text}`)
			.join('\n');
		
		try {
			await navigator.clipboard.writeText(fullTranscript);
			toast.success('Transcript copied to clipboard');
		} catch (error) {
			toast.error('Failed to copy transcript');
		}
	};

	// Download transcript as text file
	const downloadTranscript = () => {
		const fullTranscript = transcriptionHistory
			.map(entry => `[${entry.timestamp.toLocaleTimeString()}] ${entry.speakerName}: ${entry.text}`)
			.join('\n');
		
		const blob = new Blob([fullTranscript], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `interview-transcript-${roomId}-${new Date().toISOString().split('T')[0]}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		
		toast.success('Transcript downloaded');
	};

	// Format timestamp
	const formatTime = (date: Date): string => {
		return date.toLocaleTimeString('en-US', { 
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	};

	// Setup event listeners
	onMount(() => {
		// Fetch remote user info when component mounts
		fetchRemoteUserInfo();

		// No need to setup event listeners here since we create instances dynamically
		return () => {
			// Cleanup is handled in onDestroy
		};
	});

	// Cleanup on component destroy
	onDestroy(() => {
		if (localTranscriptionService) {
			localTranscriptionService.stop();
		}
		if (remoteTranscriptionService) {
			remoteTranscriptionService.stop();
		}
	});

	// Watch for remote user changes
	$effect(() => {
		if (remoteUsers.length > 0) {
			fetchRemoteUserInfo();
		}
	});
</script>

<Card.Root class="h-full">
	<Card.Header class="space-y-2">
		<div class="flex items-center justify-between">
			<Card.Title class="text-lg">Voice Transcription</Card.Title>
			<div class="flex items-center gap-2">
				<Badge 
					variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'connecting' ? 'secondary' : 'outline'}
				>
					{connectionStatus}
				</Badge>
			</div>
		</div>
		
		{#if transcriptionError}
			<div class="text-sm text-destructive bg-destructive/10 p-2 rounded">
				{transcriptionError}
			</div>
		{/if}
	</Card.Header>

	<Card.Content class="space-y-4">
		<!-- Transcription Controls -->
		<div class="space-y-3">
			<div class="flex flex-wrap gap-2">
				<!-- Local Audio Transcription -->
				<Button
					variant={isLocalTranscriptionActive ? "destructive" : "default"}
					size="sm"
					disabled={!hasLocalAudio || connectionStatus === 'connecting'}
					onclick={isLocalTranscriptionActive ? stopTranscription : startLocalTranscription}
					class="flex items-center gap-2"
				>
					{#if isLocalTranscriptionActive}
						<MicOff class="h-4 w-4" />
						Stop Local
					{:else}
						<Mic class="h-4 w-4" />
						Start Local
					{/if}
				</Button>

				<!-- Remote Audio Transcription (Only for interviewers) -->
				{#if isInterviewer}
					<Button
						variant={isRemoteTranscriptionActive ? "destructive" : "outline"}
						size="sm"
						disabled={!hasRemoteAudio || connectionStatus === 'connecting'}
						onclick={isRemoteTranscriptionActive ? stopTranscription : startRemoteTranscription}
						class="flex items-center gap-2"
					>
						{#if isRemoteTranscriptionActive}
							<VolumeX class="h-4 w-4" />
							Stop Remote
						{:else}
							<Volume2 class="h-4 w-4" />
							Start Remote
						{/if}
					</Button>
				{/if}
			</div>

			<!-- Transcript Actions -->
			{#if transcriptionHistory.length > 0}
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={copyTranscript}
						class="flex items-center gap-2"
					>
						<Copy class="h-4 w-4" />
						Copy
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={downloadTranscript}
						class="flex items-center gap-2"
					>
						<Download class="h-4 w-4" />
						Download
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={clearHistory}
						class="flex items-center gap-2"
					>
						<Trash2 class="h-4 w-4" />
						Clear
					</Button>
				</div>
			{/if}
		</div>

		<Separator />

		<!-- Live Transcription Display -->
		{#if isTranscribing}
			<div class="space-y-3">
				<!-- Current Local Transcript -->
				{#if currentLocalTranscript && isLocalTranscriptionActive}
					<div class="p-3 bg-primary/5 rounded-lg border-l-4 border-l-primary">
						<div class="text-xs text-muted-foreground mb-1">
							{userName} (Live)
						</div>
						<div class="text-sm">
							{currentLocalTranscript}
						</div>
					</div>
				{/if}

				<!-- Current Remote Transcript -->
				{#if currentRemoteTranscript && isRemoteTranscriptionActive}
					<div class="p-3 bg-secondary/5 rounded-lg border-l-4 border-l-secondary">
						<div class="text-xs text-muted-foreground mb-1">
							{remoteUserName} (Live)
						</div>
						<div class="text-sm">
							{currentRemoteTranscript}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Transcription History -->
		{#if transcriptionHistory.length > 0}
			<div class="space-y-2">
				<div class="text-sm font-medium">Transcript History</div>
				<ScrollArea class="h-64 w-full rounded border">
					<div class="space-y-3 p-3">
						{#each transcriptionHistory as entry (entry.id)}
							<div class="space-y-1">
								<div class="flex items-center justify-between text-xs text-muted-foreground">
									<span class="font-medium">
										{entry.speakerName}
									</span>
									<span>
										{formatTime(entry.timestamp)}
									</span>
								</div>
								<div class="text-sm p-2 rounded bg-muted/50">
									{entry.text}
								</div>
							</div>
						{/each}
					</div>
				</ScrollArea>
			</div>
		{:else if !isTranscribing}
			<div class="text-center text-muted-foreground py-8">
				<Mic class="h-12 w-12 mx-auto mb-4 opacity-50" />
				<p class="text-sm">Start voice transcription to see real-time conversation text</p>
				<p class="text-xs mt-2">
					{#if !hasLocalAudio}
						No local audio available
					{:else if !hasRemoteAudio && isInterviewer}
						No remote audio available for transcription
					{:else}
						Click "Start Local" to begin transcribing your voice
					{/if}
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
