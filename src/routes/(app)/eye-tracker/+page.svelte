<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		Eye, 
		Play, 
		Pause, 
		Square, 
		Camera, 
		Target, 
		Settings,
		Download,
		Trash2
	} from 'lucide-svelte';

	// Types for WebGazer
	interface GazeData {
		x: number;
		y: number;
	}

	interface GazePoint extends GazeData {
		timestamp: number;
	}

	// Svelte 5 state
	let isTracking = $state(false);
	let isCalibrated = $state(false);
	let isWebGazerLoaded = $state(false);
	let currentGaze = $state<GazeData | null>(null);
	let gazeHistory = $state<GazePoint[]>([]);
	let elapsedTime = $state(0);
	let accuracy = $state<number | null>(null);
	let calibrationPoints = $state<{ x: number; y: number; calibrated: boolean }[]>([]);
	let showCalibration = $state(false);

	// WebGazer reference
	let webgazer: any = null;
	let gazeCanvas: HTMLCanvasElement | null = null;
	let gazeContext: CanvasRenderingContext2D | null = null;

	// Initialize calibration points (9-point calibration)
	const initCalibrationPoints = () => {
		calibrationPoints = [
			{ x: 10, y: 10, calibrated: false },   // Top-left
			{ x: 50, y: 10, calibrated: false },   // Top-center
			{ x: 90, y: 10, calibrated: false },   // Top-right
			{ x: 10, y: 50, calibrated: false },   // Middle-left
			{ x: 50, y: 50, calibrated: false },   // Center
			{ x: 90, y: 50, calibrated: false },   // Middle-right
			{ x: 10, y: 90, calibrated: false },   // Bottom-left
			{ x: 50, y: 90, calibrated: false },   // Bottom-center
			{ x: 90, y: 90, calibrated: false }    // Bottom-right
		];
	};

	onMount(async () => {
		// Load WebGazer script
		await loadWebGazer();
		initCalibrationPoints();
		setupGazeCanvas();
	});

	onDestroy(() => {
		if (webgazer && isTracking) {
			stopTracking();
		}
	});

	async function loadWebGazer() {
		return new Promise<void>((resolve, reject) => {
			if (typeof window !== 'undefined' && !(window as any).webgazer) {
				const script = document.createElement('script');
				script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
				script.onload = () => {
					webgazer = (window as any).webgazer;
					isWebGazerLoaded = true;
					
					// Configure WebGazer
					webgazer
						.setRegression('ridge')
						.setTracker('clmtrackr')
						.showPredictionPoints(false)
						.showFaceOverlay(true)
						.showFaceFeedbackBox(true);
					
					resolve();
				};
				script.onerror = reject;
				document.head.appendChild(script);
			} else {
				webgazer = (window as any).webgazer;
				isWebGazerLoaded = true;
				resolve();
			}
		});
	}

	function setupGazeCanvas() {
		// Remove canvas setup - we don't need visualization
		if (typeof window !== 'undefined') {
			// Center the WebGazer video element when it's created
			setTimeout(() => {
				centerWebGazerVideo();
			}, 1000);
		}
	}

	function centerWebGazerVideo() {
		// Find WebGazer video elements and center them
		const videoElements = document.querySelectorAll('#webgazerVideoFeed, #webgazerFaceOverlay, #webgazerFaceFeedbackBox');
		
		videoElements.forEach((element) => {
			if (element instanceof HTMLElement) {
				element.style.position = 'fixed';
				element.style.top = '50%';
				element.style.left = '50%';
				element.style.transform = 'translate(-50%, -50%)';
				element.style.zIndex = '1000';
				element.style.border = '2px solid #3b82f6';
				element.style.borderRadius = '8px';
			}
		});

		// Also check for canvas elements
		const canvasElements = document.querySelectorAll('canvas');
		canvasElements.forEach((canvas) => {
			if (canvas.id.includes('webgazer') || canvas.style.position === 'fixed') {
				canvas.style.position = 'fixed';
				canvas.style.top = '50%';
				canvas.style.left = '50%';
				canvas.style.transform = 'translate(-50%, -50%)';
				canvas.style.zIndex = '1000';
			}
		});
	}

	async function startTracking() {
		if (!webgazer || !isWebGazerLoaded) return;

		try {
			await webgazer.setGazeListener((data: GazeData | null, elapsed: number) => {
				if (data) {
					currentGaze = { x: data.x, y: data.y };
					elapsedTime = elapsed;
					
					// Add to history
					gazeHistory.push({
						x: data.x,
						y: data.y,
						timestamp: Date.now()
					});

					// Keep only last 100 points
					if (gazeHistory.length > 100) {
						gazeHistory = gazeHistory.slice(-100);
					}
				}
			}).begin();

			// Center the video after starting
			setTimeout(() => {
				centerWebGazerVideo();
			}, 500);

			isTracking = true;
		} catch (error) {
			console.error('Error starting eye tracking:', error);
		}
	}

	function stopTracking() {
		if (webgazer) {
			webgazer.end();
			isTracking = false;
			
			// Remove gaze canvas
			if (gazeCanvas && gazeCanvas.parentNode) {
				gazeCanvas.parentNode.removeChild(gazeCanvas);
			}
			
			// Clear gaze visualization
			if (gazeContext && gazeCanvas) {
				gazeContext.clearRect(0, 0, gazeCanvas.width, gazeCanvas.height);
			}
		}
	}

	function pauseTracking() {
		if (webgazer) {
			webgazer.pause();
			isTracking = false;
		}
	}

	function resumeTracking() {
		if (webgazer) {
			webgazer.resume();
			isTracking = true;
		}
	}

	function drawGazePoint(x: number, y: number) {
		// Removed - no more gaze visualization
	}

	function startCalibration() {
		showCalibration = true;
		initCalibrationPoints();
	}

	function calibratePoint(index: number) {
		calibrationPoints[index].calibrated = true;
		
		// Check if all points are calibrated
		if (calibrationPoints.every(point => point.calibrated)) {
			setTimeout(() => {
				showCalibration = false;
				isCalibrated = true;
			}, 1000);
		}
	}

	function clearGazeHistory() {
		gazeHistory = [];
	}

	function downloadGazeData() {
		const dataStr = JSON.stringify(gazeHistory, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		
		const link = document.createElement('a');
		link.href = url;
		link.download = `gaze-data-${Date.now()}.json`;
		link.click();
		
		URL.revokeObjectURL(url);
	}

	// Derived values
	const statusColor = $derived(
		isTracking ? 'bg-green-500' : 
		isCalibrated ? 'bg-yellow-500' : 
		'bg-red-500'
	);

	const statusText = $derived(
		isTracking ? 'Tracking Active' :
		isCalibrated ? 'Ready to Track' :
		'Not Calibrated'
	);
</script>

<svelte:head>
	<title>Eye Tracker - WebGazer.js</title>
</svelte:head>

<div class="container mx-auto max-w-6xl space-y-6 p-6">
	<!-- Header -->
	<div class="space-y-2">
		<h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
			<Eye class="h-8 w-8" />
			Eye Tracker
		</h1>
		<p class="text-muted-foreground">
			Real-time eye movement tracking using WebGazer.js
		</p>
	</div>

	<!-- Status Bar -->
	<Card>
		<CardContent class="pt-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<Badge variant="outline" class="flex items-center gap-2">
						<div class={`w-2 h-2 rounded-full ${statusColor}`}></div>
						{statusText}
					</Badge>
					
					{#if currentGaze}
						<Badge variant="secondary">
							X: {Math.round(currentGaze.x)}, Y: {Math.round(currentGaze.y)}
						</Badge>
					{/if}
					
					{#if elapsedTime > 0}
						<Badge variant="secondary">
							Time: {Math.round(elapsedTime)}ms
						</Badge>
					{/if}
				</div>

				<div class="flex items-center space-x-2">
					<Badge variant="outline">
						Points: {gazeHistory.length}
					</Badge>
					
					{#if isWebGazerLoaded}
						<Badge variant="outline" class="bg-green-50">
							WebGazer Loaded
						</Badge>
					{:else}
						<Badge variant="outline" class="bg-red-50">
							Loading WebGazer...
						</Badge>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Controls -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Tracking Controls -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Camera class="h-5 w-5" />
					Tracking Controls
				</CardTitle>
				<CardDescription>
					Start, stop, and manage eye tracking
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="flex flex-wrap gap-2">
					{#if !isTracking}
						<Button 
							onclick={startTracking} 
							disabled={!isWebGazerLoaded}
							class="flex items-center gap-2"
						>
							<Play class="h-4 w-4" />
							Start Tracking
						</Button>
					{:else}
						<Button 
							onclick={pauseTracking}
							variant="secondary"
							class="flex items-center gap-2"
						>
							<Pause class="h-4 w-4" />
							Pause
						</Button>
						
						<Button 
							onclick={stopTracking}
							variant="destructive"
							class="flex items-center gap-2"
						>
							<Square class="h-4 w-4" />
							Stop
						</Button>
					{/if}

					{#if !isTracking && isCalibrated}
						<Button 
							onclick={resumeTracking}
							variant="outline"
							class="flex items-center gap-2"
						>
							<Play class="h-4 w-4" />
							Resume
						</Button>
					{/if}
				</div>

				<Separator />

				<div class="flex flex-wrap gap-2">
					<Button 
						onclick={startCalibration}
						variant="outline"
						disabled={isTracking}
						class="flex items-center gap-2"
					>
						<Target class="h-4 w-4" />
						Calibrate
					</Button>

					<Button 
						onclick={clearGazeHistory}
						variant="outline"
						class="flex items-center gap-2"
					>
						<Trash2 class="h-4 w-4" />
						Clear Data
					</Button>

					<Button 
						onclick={downloadGazeData}
						variant="outline"
						disabled={gazeHistory.length === 0}
						class="flex items-center gap-2"
					>
						<Download class="h-4 w-4" />
						Export Data
					</Button>
				</div>
			</CardContent>
		</Card>

		<!-- Statistics -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Settings class="h-5 w-5" />
					Statistics
				</CardTitle>
				<CardDescription>
					Real-time tracking statistics
				</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<p class="text-sm font-medium">Data Points</p>
						<p class="text-2xl font-bold">{gazeHistory.length}</p>
					</div>
					
					<div class="space-y-1">
						<p class="text-sm font-medium">Elapsed Time</p>
						<p class="text-2xl font-bold">{Math.round(elapsedTime)}ms</p>
					</div>
					
					<div class="space-y-1">
						<p class="text-sm font-medium">Calibration</p>
						<p class="text-2xl font-bold">
							{calibrationPoints.filter(p => p.calibrated).length}/9
						</p>
					</div>
					
					<div class="space-y-1">
						<p class="text-sm font-medium">Status</p>
						<Badge variant={isTracking ? "default" : "secondary"}>
							{isTracking ? "Active" : "Inactive"}
						</Badge>
					</div>
				</div>

				{#if currentGaze}
					<Separator />
					<div class="space-y-2">
						<p class="text-sm font-medium">Current Gaze Position</p>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div>X: {Math.round(currentGaze.x)}px</div>
							<div>Y: {Math.round(currentGaze.y)}px</div>
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Instructions -->
	<Card>
		<CardHeader>
			<CardTitle>Instructions</CardTitle>
			<CardDescription>How to use the eye tracker</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="space-y-2">
					<h4 class="font-semibold">1. Setup</h4>
					<p class="text-sm text-muted-foreground">
						Ensure your webcam is working and you're in a well-lit environment.
					</p>
				</div>
				
				<div class="space-y-2">
					<h4 class="font-semibold">2. Calibrate</h4>
					<p class="text-sm text-muted-foreground">
						Click "Calibrate" and look at each calibration point when it appears.
					</p>
				</div>
				
				<div class="space-y-2">
					<h4 class="font-semibold">3. Track</h4>
					<p class="text-sm text-muted-foreground">
						Start tracking to see real-time gaze predictions and data collection.
					</p>
				</div>
			</div>
		</CardContent>
	</Card>
</div>

<!-- Calibration Overlay -->
{#if showCalibration}
	<div class="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
		<div class="text-white text-center space-y-4">
			<h2 class="text-2xl font-bold">Calibration</h2>
			<p class="text-lg">Look at each red dot and click on it</p>
			<p class="text-sm opacity-75">
				{calibrationPoints.filter(p => p.calibrated).length} / {calibrationPoints.length} completed
			</p>
		</div>
		
		<!-- Calibration Points -->
		{#each calibrationPoints as point, index}
			<button
				class={`absolute w-6 h-6 rounded-full transition-all duration-300 ${
					point.calibrated 
						? 'bg-green-500 scale-75 opacity-50' 
						: 'bg-red-500 hover:bg-red-400 animate-pulse'
				}`}
				style="left: {point.x}%; top: {point.y}%; transform: translate(-50%, -50%)"
				onclick={() => calibratePoint(index)}
				disabled={point.calibrated}
			></button>
		{/each}
	</div>
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
	}

	/* Center WebGazer video elements */
	:global(#webgazerVideoFeed) {
		position: fixed !important;
		top: 50% !important;
		left: 50% !important;
		transform: translate(-50%, -50%) !important;
		z-index: 1000 !important;
		border: 2px solid #3b82f6 !important;
		border-radius: 8px !important;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
	}

	:global(#webgazerFaceOverlay) {
		position: fixed !important;
		top: 50% !important;
		left: 50% !important;
		transform: translate(-50%, -50%) !important;
		z-index: 1001 !important;
	}

	:global(#webgazerFaceFeedbackBox) {
		position: fixed !important;
		top: 50% !important;
		left: 50% !important;
		transform: translate(-50%, -50%) !important;
		z-index: 1002 !important;
	}
</style>