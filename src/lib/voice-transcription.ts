import type { ILocalAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { PUBLIC_WHISPER_API_URL } from '$env/static/public';

export interface TranscriptionMessage {
	uid: string;
	language: string;
	task: string;
	model: string;
	use_vad: boolean;
	max_clients: number;
	max_connection_time: number;
}

export interface TranscriptionResult {
	uid?: string;
	segments?: Array<{ text: string }>;
	text?: string;
	message?: string;
}

export interface TranscriptEntry {
	id: string;
	speaker: 'local' | 'remote';
	speakerName: string;
	text: string;
	timestamp: Date;
	roomId: string;
}

export type TranscriptionHandler = (result: TranscriptionResult) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: string) => void;

export class VoiceTranscriptionService {
	private ws: WebSocket | null = null;
	private audioContext: AudioContext | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private isConnected = false;
	private isServerReady = false;
	private roomId: string | null = null;
	private userId: string | null = null;
	private speakerType: 'local' | 'remote' = 'local';
	private speakerName: string = '';

	private transcriptionHandlers: TranscriptionHandler[] = [];
	private connectionHandlers: ConnectionHandler[] = [];
	private disconnectionHandlers: ConnectionHandler[] = [];
	private errorHandlers: ErrorHandler[] = [];

	// LocalStorage key for transcript data
	private static getTranscriptKey(roomId: string): string {
		return `interview_transcript_${roomId}`;
	}

	private readonly WS_URL = PUBLIC_WHISPER_API_URL;

	// AudioWorklet processor code for downsampling to 16kHz
	private readonly audioWorkletCode = `
		class AudioPreProcessor extends AudioWorkletProcessor {
			constructor() {
				super();
				this.sampleRate = sampleRate || 48000;
				this.targetSampleRate = 16000;
				this.inputSamplesNeeded = this.sampleRate * 0.1; // 0.1s chunks for faster response
				this.inputBuffer = new Float32Array(this.inputSamplesNeeded);
				this.inputWriteOffset = 0;
			}

			process(inputs, outputs) {
				const input = inputs[0];
				
				if (!input || input.length === 0) {
					return true;
				}

				// Get mono input
				let monoInput;
				if (input.length === 1) {
					monoInput = input[0];
				} else if (input.length >= 2) {
					monoInput = new Float32Array(input[0].length);
					for (let i = 0; i < input[0].length; i++) {
						monoInput[i] = (input[0][i] + (input[1] ? input[1][i] : 0)) * 0.5;
					}
				} else {
					return true;
				}

				if (!monoInput || monoInput.length === 0) {
					return true;
				}

				// Buffer and downsample
				let inputOffset = 0;
				while (inputOffset < monoInput.length) {
					const remainingBuffer = this.inputSamplesNeeded - this.inputWriteOffset;
					const toCopy = Math.min(remainingBuffer, monoInput.length - inputOffset);
					this.inputBuffer.set(monoInput.subarray(inputOffset, inputOffset + toCopy), this.inputWriteOffset);

					this.inputWriteOffset += toCopy;
					inputOffset += toCopy;

					if (this.inputWriteOffset === this.inputSamplesNeeded) {
						const downsampled = this.downsampleTo16kHz(this.inputBuffer);
						this.port.postMessage(downsampled);
						this.inputWriteOffset = 0;
					}
				}

				return true;
			}

			downsampleTo16kHz(inputBuffer) {
				const ratio = this.sampleRate / this.targetSampleRate;
				const length = Math.floor(inputBuffer.length / ratio);
				const result = new Float32Array(length);
				for (let i = 0; i < length; i++) {
					const idx = Math.floor(i * ratio);
					result[i] = inputBuffer[idx];
				}
				return result;
			}
		}

		registerProcessor('audiopreprocessor', AudioPreProcessor);
	`;

	// Generate a unique client ID
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	// Connect to transcription WebSocket
	private async connectWebSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.WS_URL);
			this.isServerReady = false;
			this.userId = this.generateUUID();

			this.ws.onopen = () => {
				console.log('Voice transcription WebSocket connected');

				// Send initial configuration
				const initMessage: TranscriptionMessage = {
					uid: this.userId!,
					language: 'en',
					task: 'transcribe',
					model: 'tiny.en', // Use English-only tiny model for fastest CPU inference
					use_vad: true,
					max_clients: 1,
					max_connection_time: 600
				};

				if (this.ws) {
					this.ws.send(JSON.stringify(initMessage));
				}
				resolve();
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as TranscriptionResult;

					// Check if it's our client
					if (data.uid && data.uid !== this.userId) {
						return;
					}

					// Server ready signal
					if (data.message === 'SERVER_READY') {
						this.isServerReady = true;
						console.log('Transcription server ready');
						this.connectionHandlers.forEach((handler) => handler());
						return;
					}

					// Handle transcription results
					if (data.segments && Array.isArray(data.segments)) {
						const newText = data.segments.map((seg: any) => seg.text).join(' ');
						this.addToTranscriptHistory(newText);
						this.transcriptionHandlers.forEach((handler) => handler({ ...data, text: newText }));
					} else if (data.text) {
						this.addToTranscriptHistory(data.text);
						this.transcriptionHandlers.forEach((handler) => handler(data));
					}
				} catch (e) {
					console.log('Non-JSON transcription message:', event.data);
				}
			};

			this.ws.onclose = () => {
				console.log('Voice transcription WebSocket disconnected');
				this.isConnected = false;
				this.isServerReady = false;
				this.disconnectionHandlers.forEach((handler) => handler());
			};

			this.ws.onerror = (error) => {
				console.error('Voice transcription WebSocket error:', error);
				this.errorHandlers.forEach((handler) => handler('WebSocket connection failed'));
				reject(new Error('WebSocket connection failed'));
			};
		});
	}

	// Setup audio processing for transcription
	private async setupAudioProcessing(
		audioTrack: ILocalAudioTrack | MediaStreamTrack
	): Promise<void> {
		try {
			// Create audio context
			this.audioContext = new AudioContext();
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
			}

			// Add the AudioWorklet
			const workletBlob = new Blob([this.audioWorkletCode], { type: 'application/javascript' });
			const workletUrl = URL.createObjectURL(workletBlob);
			await this.audioContext.audioWorklet.addModule(workletUrl);

			// Create the worklet node
			this.workletNode = new AudioWorkletNode(this.audioContext, 'audiopreprocessor');

			// Handle processed audio
			this.workletNode.port.onmessage = (event) => {
				const audio16k = event.data as Float32Array;

				if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isServerReady) {
					// Send raw Float32Array as WhisperLive expects
					this.ws.send(audio16k);
				}
			};

			// Connect audio source
			let mediaStream: MediaStream;

			if (audioTrack instanceof MediaStreamTrack) {
				// Direct MediaStreamTrack
				mediaStream = new MediaStream([audioTrack]);
			} else {
				// Agora ILocalAudioTrack - get the MediaStreamTrack
				const agoraTrack = audioTrack as any;
				if (agoraTrack.getMediaStreamTrack) {
					const track = agoraTrack.getMediaStreamTrack();
					mediaStream = new MediaStream([track]);
				} else {
					throw new Error('Unable to get MediaStreamTrack from Agora audio track');
				}
			}

			this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);
			this.sourceNode.connect(this.workletNode);

			URL.revokeObjectURL(workletUrl);
			console.log('Audio processing setup complete');
		} catch (error) {
			console.error('Error setting up audio processing:', error);
			throw error;
		}
	}

	// Start transcription for local audio (interviewer/interviewee speaking)
	async startLocalTranscription(
		audioTrack: ILocalAudioTrack,
		roomId: string,
		speakerName?: string
	): Promise<void> {
		try {
			this.roomId = roomId;
			this.userId = this.generateUUID();
			this.speakerType = 'local';
			this.speakerName = speakerName || 'You';

			// Connect to transcription service
			await this.connectWebSocket();

			// Wait for server to be ready
			await new Promise<void>((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					reject(new Error('Server ready timeout'));
				}, 10000); // 10 second timeout

				const checkReady = () => {
					if (this.isServerReady) {
						clearTimeout(timeoutId);
						resolve();
					} else {
						setTimeout(checkReady, 100);
					}
				};
				setTimeout(checkReady, 500);
			});

			// Setup audio processing
			await this.setupAudioProcessing(audioTrack);

			this.isConnected = true;
			console.log('Local voice transcription started');
		} catch (error) {
			console.error('Error starting local transcription:', error);
			this.cleanup();
			throw error;
		}
	}

	// Start transcription for remote audio (other participant speaking)
	async startRemoteTranscription(
		remoteUser: IAgoraRTCRemoteUser,
		roomId: string,
		speakerName?: string
	): Promise<void> {
		try {
			this.roomId = roomId;
			this.userId = this.generateUUID();
			this.speakerType = 'remote';
			this.speakerName = speakerName || 'Other';

			if (!remoteUser.audioTrack) {
				throw new Error('Remote user has no audio track');
			}

			// Connect to transcription service
			await this.connectWebSocket();

			// Wait for server to be ready
			await new Promise<void>((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					reject(new Error('Server ready timeout'));
				}, 10000); // 10 second timeout

				const checkReady = () => {
					if (this.isServerReady) {
						clearTimeout(timeoutId);
						resolve();
					} else {
						setTimeout(checkReady, 100);
					}
				};
				setTimeout(checkReady, 500);
			});

			// Get the MediaStreamTrack from remote audio
			const remoteAudioTrack = (remoteUser.audioTrack as any).getMediaStreamTrack();
			if (!remoteAudioTrack) {
				throw new Error('Unable to get MediaStreamTrack from remote audio');
			}

			// Setup audio processing
			await this.setupAudioProcessing(remoteAudioTrack);

			this.isConnected = true;
			console.log('Remote voice transcription started');
		} catch (error) {
			console.error('Error starting remote transcription:', error);
			this.cleanup();
			throw error;
		}
	}

	// Add transcript entry to history
	private addToTranscriptHistory(text: string): void {
		if (!this.roomId || !text.trim()) return;

		const entry: TranscriptEntry = {
			id: this.generateUUID(),
			speaker: this.speakerType,
			speakerName: this.speakerName,
			text: text.trim(),
			timestamp: new Date(),
			roomId: this.roomId
		};

		// Get existing transcript from localStorage
		const existingTranscript = this.getTranscriptFromLocalStorage(this.roomId);
		existingTranscript.push(entry);

		// Save back to localStorage
		this.saveTranscriptToLocalStorage(this.roomId, existingTranscript);

		console.log('Added transcript entry to localStorage:', {
			roomId: this.roomId,
			speaker: this.speakerType,
			speakerName: this.speakerName,
			textLength: text.length,
			totalEntries: existingTranscript.length
		});
	}

	// Get transcript from localStorage
	private getTranscriptFromLocalStorage(roomId: string): TranscriptEntry[] {
		try {
			const key = VoiceTranscriptionService.getTranscriptKey(roomId);
			const stored = localStorage.getItem(key);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error('Error reading transcript from localStorage:', error);
			return [];
		}
	}

	// Save transcript to localStorage
	private saveTranscriptToLocalStorage(roomId: string, transcript: TranscriptEntry[]): void {
		try {
			const key = VoiceTranscriptionService.getTranscriptKey(roomId);
			localStorage.setItem(key, JSON.stringify(transcript));
		} catch (error) {
			console.error('Error saving transcript to localStorage:', error);
		}
	}

	// Get transcript history for a room from localStorage (browser only)
	static getTranscriptHistory(roomId: string): TranscriptEntry[] {
		// Check if we're in a browser environment
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			console.warn('localStorage not available (server-side), returning empty transcript');
			return [];
		}

		try {
			const key = VoiceTranscriptionService.getTranscriptKey(roomId);
			const stored = localStorage.getItem(key);
			const history = stored ? JSON.parse(stored) : [];

			console.log('Retrieved transcript from localStorage:', {
				roomId,
				entryCount: history.length,
				key
			});

			return history;
		} catch (error) {
			console.error('Error reading transcript from localStorage:', error);
			return [];
		}
	}

	// Clear transcript history for a room from localStorage (browser only)
	static clearTranscriptHistory(roomId: string): void {
		// Check if we're in a browser environment
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			console.warn('localStorage not available (server-side), cannot clear transcript');
			return;
		}

		try {
			const key = VoiceTranscriptionService.getTranscriptKey(roomId);
			localStorage.removeItem(key);
			console.log('Cleared transcript history from localStorage for room:', roomId);
		} catch (error) {
			console.error('Error clearing transcript from localStorage:', error);
		}
	}

	// Get formatted transcript text for AI analysis (browser only)
	static getFormattedTranscript(roomId: string): string {
		const history = VoiceTranscriptionService.getTranscriptHistory(roomId);
		if (history.length === 0) {
			return 'No transcript available yet.';
		}

		return history
			.map((entry) => {
				const time = new Date(entry.timestamp).toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				});
				return `[${time}] ${entry.speakerName}: ${entry.text}`;
			})
			.join('\n');
	}

	// Add test transcript entries (for debugging) (browser only)
	static addTestTranscriptEntries(roomId: string): number {
		// Check if we're in a browser environment
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			console.warn('localStorage not available (server-side), cannot add test transcript');
			return 0;
		}

		const testEntries: TranscriptEntry[] = [
			{
				id: 'test-1',
				speaker: 'local',
				speakerName: 'Interviewer',
				text: 'Can you explain your approach to this sorting problem?',
				timestamp: new Date(Date.now() - 60000),
				roomId: roomId
			},
			{
				id: 'test-2',
				speaker: 'remote',
				speakerName: 'Candidate',
				text: 'I am thinking of using merge sort because it has guaranteed O(n log n) performance.',
				timestamp: new Date(Date.now() - 45000),
				roomId: roomId
			},
			{
				id: 'test-3',
				speaker: 'local',
				speakerName: 'Interviewer',
				text: 'Why did you choose merge sort over quick sort?',
				timestamp: new Date(Date.now() - 30000),
				roomId: roomId
			}
		];

		// Get current history from localStorage and add test entries
		const currentHistory = VoiceTranscriptionService.getTranscriptHistory(roomId);
		const updatedHistory = [...currentHistory, ...testEntries];

		// Save to localStorage
		try {
			const key = VoiceTranscriptionService.getTranscriptKey(roomId);
			localStorage.setItem(key, JSON.stringify(updatedHistory));
			console.log(
				'Added test transcript entries to localStorage for room:',
				roomId,
				'Total entries:',
				updatedHistory.length
			);
		} catch (error) {
			console.error('Error saving test transcript to localStorage:', error);
		}

		return testEntries.length;
	}

	// Stop transcription
	stop(): void {
		this.cleanup();
		console.log('Voice transcription stopped');
	}

	// Cleanup resources
	private cleanup(): void {
		if (this.workletNode) {
			this.workletNode.port.onmessage = null;
			this.workletNode.disconnect();
			this.workletNode = null;
		}

		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.isConnected = false;
		this.isServerReady = false;
	}

	// Event handlers
	onTranscription(handler: TranscriptionHandler): () => void {
		this.transcriptionHandlers.push(handler);
		return () => {
			const index = this.transcriptionHandlers.indexOf(handler);
			if (index > -1) {
				this.transcriptionHandlers.splice(index, 1);
			}
		};
	}

	onConnection(handler: ConnectionHandler): () => void {
		this.connectionHandlers.push(handler);
		return () => {
			const index = this.connectionHandlers.indexOf(handler);
			if (index > -1) {
				this.connectionHandlers.splice(index, 1);
			}
		};
	}

	onDisconnection(handler: ConnectionHandler): () => void {
		this.disconnectionHandlers.push(handler);
		return () => {
			const index = this.disconnectionHandlers.indexOf(handler);
			if (index > -1) {
				this.disconnectionHandlers.splice(index, 1);
			}
		};
	}

	onError(handler: ErrorHandler): () => void {
		this.errorHandlers.push(handler);
		return () => {
			const index = this.errorHandlers.indexOf(handler);
			if (index > -1) {
				this.errorHandlers.splice(index, 1);
			}
		};
	}

	// Getters
	get connected(): boolean {
		return this.isConnected;
	}

	get serverReady(): boolean {
		return this.isServerReady;
	}
}

// Export singleton instance
export const voiceTranscriptionService = new VoiceTranscriptionService();
