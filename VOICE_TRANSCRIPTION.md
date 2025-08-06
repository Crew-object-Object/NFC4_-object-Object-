# Voice Transcription with Subtitle Overlay

This document explains how the voice transcription functionality has been integrated with the Agora video call system to provide real-time subtitles during interviews.

## Overview

The voice transcription feature provides real-time speech-to-text conversion displayed as subtitle overlays on the video stream. This simplified approach offers:

- **Real-time subtitles** overlaid directly on the video
- **Color-coded speakers**: Yellow for your speech, white for others
- **Simple toggle control**: One button to enable/disable all transcription
- **Automatic management**: No complex UI or manual controls needed

## Key Features

### Subtitle Display
- **Your Speech**: Yellow subtitles with your name
- **Other Speech**: White subtitles with participant's name  
- **Auto-hide**: Subtitles disappear after 3 seconds of silence
- **Overlay Position**: Subtitles appear at the top of the video stream

### Simple Controls
- **Single Toggle**: One button in video controls enables/disables all transcription
- **Automatic Setup**: Transcribes both local and remote audio when enabled
- **No Configuration**: Works out of the box with sensible defaults

## Components

### VoiceSubtitles Component (`/src/lib/components/voice-subtitles.svelte`)
- Manages transcription services for both local and remote audio
- Displays subtitle overlays with proper styling and positioning
- Handles automatic subtitle timing and cleanup

### Enhanced VideoCall Component
- Simple MessageSquare toggle button in video controls
- Integrated subtitle overlay system
- No complex panels or additional UI elements

## Usage Instructions

### For All Users (Interviewers & Interviewees)
1. Join the interview room
2. Click the **message square icon** in the video controls
3. Both your speech and the other participant's speech will be transcribed
4. Click the icon again to disable subtitles

### Subtitle Appearance
- **Your speech**: Yellow box with your name at top of video
- **Other speech**: White box with their name below your subtitles
- **Auto-clear**: Subtitles fade after 3 seconds of no new speech

## Technical Implementation

### Audio Processing Pipeline
```typescript
// Simultaneous transcription of both audio sources
if (localAudioTrack) {
  localTranscriptionService = new VoiceTranscriptionService();
  await localTranscriptionService.startLocalTranscription(localAudioTrack, roomId);
}

if (remoteUsers[0]?.audioTrack) {
  remoteTranscriptionService = new VoiceTranscriptionService();
  await remoteTranscriptionService.startRemoteTranscription(remoteUsers[0], roomId);
}
```

### Subtitle Styling
```svelte
<!-- Local subtitle (yellow) -->
<div class="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border-l-4 border-yellow-400">
  <div class="text-xs text-yellow-400 mb-1 font-medium">{userName}</div>
  <div class="text-sm text-white leading-tight">{localSubtitle}</div>
</div>

<!-- Remote subtitle (white) -->
<div class="bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 border-l-4 border-white">
  <div class="text-xs text-gray-300 mb-1 font-medium">{remoteUserName}</div>
  <div class="text-sm text-white leading-tight">{remoteSubtitle}</div>
</div>
```

## Configuration

### WhisperLive Server Settings
- **Server URL**: `ws://localhost:9090`
- **Model**: `tiny.en` for fast English transcription
- **VAD**: Voice Activity Detection enabled
- **Chunks**: 0.1 second audio chunks for responsiveness

### Subtitle Timing
- **Display Duration**: 3 seconds after last speech
- **Update Frequency**: Real-time with VAD detection
- **Position**: Fixed overlay at top of video stream

## Privacy & Performance

### Simplified Privacy Model
- **Automatic**: Both participants are transcribed when enabled
- **Equal Access**: Same functionality for all users
- **No Storage**: Subtitles exist only during the session
- **Local Processing**: Audio processed locally before transmission

### Performance Optimizations
- **Lightweight UI**: No complex panels or history management
- **Efficient Rendering**: Subtitles only render when text is present
- **Automatic Cleanup**: Resources cleaned up when disabled
- **Minimal Memory**: No transcript history storage

## Troubleshooting

### Common Issues

**Subtitles not appearing:**
- Check if WhisperLive server is running on localhost:9090
- Verify the subtitle toggle is enabled (MessageSquare button highlighted)
- Ensure microphone permissions are granted
- Check that audio tracks are available in the video call

**Poor subtitle accuracy:**
- Speak clearly and at normal volume
- Ensure stable internet connection
- Check for background noise interference
- Verify microphone quality

**Subtitles not disappearing:**
- This is normal behavior - they auto-hide after 3 seconds
- If stuck, toggle subtitles off and on again
- Check browser console for any errors

### Debug Information
Enable browser console to see transcription status:
```
Local transcription started
Remote transcription started
Voice transcription stopped
```

## Comparison with Previous Version

### What Changed
- **Removed**: Complex transcription panel UI
- **Removed**: Manual start/stop controls for each audio source
- **Removed**: Transcript history and export features
- **Removed**: Separate interviewer/interviewee permissions

### What's New
- **Added**: Simple single-toggle control
- **Added**: Automatic subtitle overlay system
- **Added**: Color-coded speaker identification
- **Added**: Auto-hide subtitle timing
- **Simplified**: One-click enable/disable for everything

### Benefits
- **Easier to Use**: No learning curve or complex controls
- **Better UX**: Subtitles integrated directly into video experience
- **Cleaner UI**: No additional panels or overlays cluttering interface
- **Automatic**: Works without user configuration or management
