<script>
	import Tiptap from '$lib/components/tiptap.svelte';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import GripHorizontalIcon from '@lucide/svelte/icons/grip-horizontal';
	import VideoIcon from '@lucide/svelte/icons/video';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
</script>

<main class="h-px grow px-4 py-0">
	<div class="h-full border rounded-lg overflow-hidden">
		<PaneGroup direction="horizontal">
			<!-- Editor Section -->
			<Pane defaultSize={60} minSize={40}>
				<div class="bg-background h-full flex flex-col">
					<div class="flex-1 px-4 py-2">
						<Tiptap />
					</div>
				</div>
			</Pane>

			<PaneResizer class="w-2 bg-border hover:bg-accent transition-colors flex items-center justify-center group">
				<div class="opacity-60 group-hover:opacity-100 transition-opacity">
					<GripVerticalIcon size={16} />
				</div>
			</PaneResizer>

			<!-- Right Side Panel -->
			<Pane defaultSize={40} minSize={30}>
				<PaneGroup direction="vertical">
					<!-- Video Section -->
					<Pane defaultSize={50} minSize={25}>
						<div class="bg-background h-full flex flex-col">
							<div class="px-4 py-2 border-b flex items-center gap-2">
								<VideoIcon size={16} />
								<h3 class="text-sm font-medium">Video Call</h3>
							</div>
							<div class="flex-1 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
								<div class="text-center text-slate-500">
									<svg class="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
									<p class="text-sm">Video call placeholder</p>
								</div>
							</div>
						</div>
					</Pane>

					<PaneResizer class="h-2 bg-border hover:bg-accent transition-colors flex items-center justify-center group">
						<div class="opacity-60 group-hover:opacity-100 transition-opacity">
							<GripHorizontalIcon size={16} />
						</div>
					</PaneResizer>

					<!-- Chat Section -->
					<Pane defaultSize={50} minSize={25}>
						<div class="bg-background h-full flex flex-col">
							<div class="px-4 py-2 border-b flex items-center gap-2">
								<MessageCircleIcon size={16} />
								<h3 class="text-sm font-medium">Chat</h3>
							</div>
							<div class="flex-1 p-4 overflow-y-auto">
								<div class="space-y-3">
									<!-- Sample chat messages -->
									<div class="flex items-start space-x-2">
										<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
											JD
										</div>
										<div class="flex-1">
											<div class="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
												<p class="text-sm">Hey, let's collaborate on this document!</p>
											</div>
											<p class="text-xs text-slate-500 mt-1">2 minutes ago</p>
										</div>
									</div>
									<div class="flex items-start space-x-2">
										<div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
											AS
										</div>
										<div class="flex-1">
											<div class="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
												<p class="text-sm">Sounds good! I'll start with the introduction.</p>
											</div>
											<p class="text-xs text-slate-500 mt-1">1 minute ago</p>
										</div>
									</div>
								</div>
							</div>
							<div class="p-4 border-t">
								<div class="flex space-x-2">
									<input 
										type="text" 
										placeholder="Type a message..." 
										class="flex-1 px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
									/>
									<button class="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
										Send
									</button>
								</div>
							</div>
						</div>
					</Pane>
				</PaneGroup>
			</Pane>
		</PaneGroup>
	</div>
</main>
