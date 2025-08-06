<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { MessageSquare, Mic } from 'lucide-svelte';

  let transcript = $state("");
  let recording = $state(false);
  let socketStatus = $state<"disconnected" | "connecting" | "connected">("disconnected");
  let ws: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let isServerReady = $state(false);
  let workletNode: AudioWorkletNode | null = null;
  
  const WS_URL = "ws://localhost:9090";

  // Generate a unique client ID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // AudioWorklet processor for downsampling to 16kHz
  const audioWorkletCode = `
    class AudioPreProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.sampleRate = sampleRate || 48000;
        this.targetSampleRate = 16000;
        this.inputSamplesNeeded = this.sampleRate * 0.1; // Even smaller 0.1s for faster response
        this.inputBuffer = new Float32Array(this.inputSamplesNeeded);
        this.inputWriteOffset = 0;
      }

      process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || input.length === 0) {
          return true;
        }

        // Pass through for monitoring
        for (let channel = 0; channel < Math.min(input.length, output.length); channel++) {
          if (input[channel] && output[channel]) {
            output[channel].set(input[channel]);
          }
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

  async function startRecording() {
    try {
      // Get microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false
        }
      });

      // Create audio context
      audioContext = new AudioContext();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Add the AudioWorklet
      const workletBlob = new Blob([audioWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioContext.audioWorklet.addModule(workletUrl);

      // Create the worklet node
      workletNode = new AudioWorkletNode(audioContext, 'audiopreprocessor');
      const source = audioContext.createMediaStreamSource(mediaStream);

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // Handle processed audio
      workletNode.port.onmessage = (event) => {
        const audio16k = event.data as Float32Array;
        
        if (ws && ws.readyState === WebSocket.OPEN && isServerReady) {
          // Send raw Float32Array as WhisperLive expects
          ws.send(audio16k);
        }
      };

      recording = true;
      URL.revokeObjectURL(workletUrl);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      socketStatus = "disconnected";
    }
  }

  function stopRecording() {
    if (workletNode) {
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      workletNode = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
    
    recording = false;
    isServerReady = false;
  }

  function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    socketStatus = "connecting";
    isServerReady = false;
    const uuid = generateUUID();
    
    ws.onopen = () => {
      socketStatus = "connected";
      console.log("WebSocket connected");
      
      // Send initial configuration as JSON
      const initMessage = {
        uid: uuid,
        language: "en",
        task: "transcribe",
        model: "tiny.en",  // Use English-only tiny model for fastest CPU inference
        use_vad: true,
        max_clients: 1,    // Reduce to 1 for better CPU performance
        max_connection_time: 600
      };
      
      if (ws) {
        ws.send(JSON.stringify(initMessage));
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Check if it's our client
        if (data.uid && data.uid !== uuid) {
          return;
        }
        
        // Server ready signal
        if (data.message === "SERVER_READY") {
          isServerReady = true;
          console.log("Server ready, starting audio stream");
          return;
        }
        
        // Handle transcription results
        if (data.segments && Array.isArray(data.segments)) {
          const newText = data.segments.map((seg: any) => seg.text).join(" ");
          transcript = newText;
        }
        
        // Also handle partial results for faster updates
        if (data.text) {
          transcript = data.text;
        }
        
      } catch (e) {
        console.log("Non-JSON message:", event.data);
      }
    };
    
    ws.onclose = () => {
      socketStatus = "disconnected";
      isServerReady = false;
      console.log("WebSocket disconnected");
    };
    
    ws.onerror = (error) => {
      socketStatus = "disconnected";
      isServerReady = false;
      console.error("WebSocket error:", error);
    };
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      transcript = ""; // Clear previous transcript
      connectWebSocket();
      
      // Wait for server ready before starting recording
      const checkServerReady = () => {
        if (isServerReady) {
          startRecording();
        } else if (socketStatus === "disconnected") {
          console.error("Failed to connect to WebSocket");
        } else {
          setTimeout(checkServerReady, 100);
        }
      };
      
      setTimeout(checkServerReady, 500); // Give initial connection some time
    }
  }
</script>

<div class="container mx-auto max-w-4xl p-6 space-y-6">
  <div class="space-y-2">
    <h1 class="text-3xl font-bold tracking-tight">Voice Transcription Test</h1>
    <p class="text-muted-foreground">Test the voice transcription system integrated with video calls</p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <MessageSquare class="h-5 w-5" />
        Real-time Voice Transcription
      </Card.Title>
      <Card.Description>
        This demonstrates the same transcription system used in video interviews, now with subtitle-style display.
      </Card.Description>
    </Card.Header>
    
    <Card.Content class="space-y-6">
      <!-- Controls -->
      <div class="flex items-center gap-4">
        <Button
          onclick={toggleRecording}
          variant={recording ? "destructive" : "default"}
          class="flex items-center gap-2"
        >
          <Mic class="h-4 w-4" />
          {recording ? "Stop Recording" : "Start Recording"}
        </Button>
        
        <Badge variant={socketStatus === 'connected' ? 'default' : socketStatus === 'connecting' ? 'secondary' : 'outline'}>
          {socketStatus}
        </Badge>
        
        {#if isServerReady}
          <Badge variant="default" class="bg-green-500">
            Server Ready
          </Badge>
        {/if}
      </div>

      <!-- Simulated Video Area with Subtitle Overlay -->
      <div class="relative">
        <div class="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border flex items-center justify-center">
          <div class="text-center text-white/60">
            <div class="text-6xl mb-4">🎥</div>
            <p class="text-lg">Simulated Video Stream</p>
            <p class="text-sm">Subtitles will appear over this area</p>
          </div>
        </div>
        
        <!-- Subtitle Overlay (simulating the actual implementation) -->
        {#if transcript && recording}
          <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 max-w-[80%]">
            <div class="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border-l-4 border-yellow-400">
              <div class="text-xs text-yellow-400 mb-1 font-medium">You</div>
              <div class="text-sm text-white leading-tight">{transcript}</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Technical Info -->
      <div class="space-y-2 text-sm text-muted-foreground">
        <h3 class="font-medium text-foreground">How it works in video calls:</h3>
        <ul class="space-y-1 list-disc list-inside">
          <li><strong class="text-yellow-500">Yellow subtitles</strong> show your own speech</li>
          <li><strong class="text-white">White subtitles</strong> show the other participant's speech</li>
          <li>Simply toggle the subtitle button in video controls to enable/disable</li>
          <li>Subtitles automatically disappear after 3 seconds of silence</li>
          <li>Uses the same WhisperLive server (ws://localhost:9090)</li>
        </ul>
      </div>

      <!-- Status Info -->
      <div class="p-4 bg-muted rounded-lg">
        <h3 class="font-medium mb-2">Current Status:</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">WebSocket:</span>
            <span class="ml-2 font-medium">{socketStatus}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Recording:</span>
            <span class="ml-2 font-medium">{recording ? 'Active' : 'Inactive'}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Server Ready:</span>
            <span class="ml-2 font-medium">{isServerReady ? 'Yes' : 'No'}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Last Text:</span>
            <span class="ml-2 font-medium">{transcript ? 'Received' : 'None'}</span>
          </div>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
</div>
