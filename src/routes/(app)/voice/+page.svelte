<script lang="ts">
  let transcript = "";
  let recording = false;
  let socketStatus = "disconnected";
  let ws: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;
  let isServerReady = false;
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
      socketStatus = "error";
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
      socketStatus = "error";
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
        } else if (socketStatus === "error") {
          console.error("Failed to connect to WebSocket");
        } else {
          setTimeout(checkServerReady, 100);
        }
      };
      
      setTimeout(checkServerReady, 500); // Give initial connection some time
    }
  }
</script>

<style>
  button { padding: .5rem 1rem; border: none; background:#2563eb; color:#fff; border-radius:6px; cursor:pointer; }
  .status { font-size:.9rem; margin-top:.5rem; }
  pre { background:#f5f5f5; padding:1rem; border-radius:4px; overflow:auto; }
</style>

<div>
  <button on:click={toggleRecording}>
    {recording ? "Stop" : "Start"} mic stream
  </button>
  <div class="status">WebSocket: {socketStatus}</div>
  <div class="status">Transcript: <strong>{transcript}</strong></div>
  <pre>{JSON.stringify({ socketStatus, transcript }, null, 2)}</pre>
</div>
