<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { Problem } from '$lib/problemset';
	import { createEventDispatcher } from 'svelte';

	interface InterviewProblem {
		id: string;
		title: string;
		description: string;
		score: number;
		testCases: {
			testCaseId: string;
			input: string;
			output: string;
		}[];
	}

	// Props
	export let open: boolean = false;
	export let availableProblems: Problem[] = [];
	export let isLoading: boolean = false;
	export const roomId: string = '';

	// Local state
	let selectedProblem: Problem | null = null;
	let customProblemTitle = '';
	let customProblemDescription = '';

	const dispatch = createEventDispatcher<{
		close: void;
		addProblemFromSet: { problem: Problem };
		addCustomProblem: { title: string; description: string };
	}>();

	// Reset form when dialog closes
	$: if (!open) {
		selectedProblem = null;
		customProblemTitle = '';
		customProblemDescription = '';
	}

	const handleCancel = () => {
		dispatch('close');
	};

	const handleAddProblem = () => {
		if (selectedProblem) {
			dispatch('addProblemFromSet', { problem: selectedProblem });
		} else {
			dispatch('addCustomProblem', {
				title: customProblemTitle.trim(),
				description: customProblemDescription.trim()
			});
		}
	};

	$: isFormValid =
		selectedProblem || (customProblemTitle.trim() && customProblemDescription.trim());
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full overflow-y-auto p-6 sm:max-w-2xl">
		<Sheet.Header>
			<Sheet.Title>Add Problem to Interview</Sheet.Title>
			<Sheet.Description>Choose from predefined problems or create a custom one.</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-6 py-6">
			<!-- Custom Problem Form -->
			<div class="space-y-4">
				<div>
					<Label for="problem-title">Problem Title</Label>
					<Input
						id="problem-title"
						bind:value={customProblemTitle}
						placeholder="Enter problem title..."
						class="mt-1"
					/>
				</div>
				<div>
					<Label for="problem-description">Problem Description</Label>
					<Textarea
						id="problem-description"
						bind:value={customProblemDescription}
						placeholder="Enter problem description..."
						rows={6}
						class="mt-1"
					/>
				</div>
			</div>

			<!-- Predefined Problems List -->
			<div class="space-y-4">
				<h3 class="text-sm font-medium text-muted-foreground">
					Or choose from predefined problems:
				</h3>
				<div class="max-h-64 space-y-2 overflow-y-auto rounded-lg border">
					{#each availableProblems as problem}
						<button
							class="w-full border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted"
							onclick={() => (selectedProblem = problem)}
						>
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<h4 class="text-sm font-medium">{problem.title}</h4>
									<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">
										{problem.description}
									</p>
								</div>
								<div class="ml-2 flex items-center gap-2">
									<Badge variant="outline" class="text-xs">
										{problem.difficulty}
									</Badge>
									<Badge variant="secondary" class="text-xs">
										{problem.testCases.length} tests
									</Badge>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>

			{#if selectedProblem}
				<!-- Selected Problem Preview -->
				<div class="rounded-lg border bg-muted/50 p-4">
					<div class="mb-2 flex items-center justify-between">
						<h4 class="font-semibold">{selectedProblem.title}</h4>
						<div class="flex items-center gap-2">
							<Badge variant="outline">{selectedProblem.difficulty}</Badge>
							<Badge variant="secondary">{selectedProblem.testCases.length} test cases</Badge>
						</div>
					</div>
					<p class="mb-3 text-sm text-muted-foreground">{selectedProblem.description}</p>
					<div class="text-xs text-muted-foreground">
						<strong>Tags:</strong>
						{selectedProblem.tags.join(', ')}
					</div>
				</div>
			{/if}
		</div>

		<div class="flex gap-2 pt-6">
			<Button variant="outline" onclick={handleCancel}>Cancel</Button>
			<Button onclick={handleAddProblem} disabled={isLoading || !isFormValid}>
				{#if isLoading}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
				{/if}
				Add Problem
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
