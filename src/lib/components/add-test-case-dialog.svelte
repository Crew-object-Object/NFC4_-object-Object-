<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
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
	export let selectedProblem: InterviewProblem | null = null;
	export let isLoading: boolean = false;

	// Local state
	let newTestCaseInput = '';
	let newTestCaseOutput = '';

	const dispatch = createEventDispatcher<{
		close: void;
		addTestCase: { input: string; output: string; problemId: string };
	}>();

	// Reset form when dialog closes
	$: if (!open) {
		newTestCaseInput = '';
		newTestCaseOutput = '';
	}

	const handleCancel = () => {
		dispatch('close');
	};

	const handleAddTestCase = () => {
		if (selectedProblem && newTestCaseInput.trim() && newTestCaseOutput.trim()) {
			dispatch('addTestCase', { 
				input: newTestCaseInput.trim(), 
				output: newTestCaseOutput.trim(),
				problemId: selectedProblem.id
			});
		}
	};

	$: isFormValid = newTestCaseInput.trim() && newTestCaseOutput.trim();
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="w-full p-6 sm:max-w-lg">
		<Sheet.Header>
			<Sheet.Title>Add Test Case</Sheet.Title>
			<Sheet.Description>
				Add a new test case to "{selectedProblem?.title}".
			</Sheet.Description>
		</Sheet.Header>

		<div class="space-y-4 py-6">
			<div>
				<Label for="test-input">Input</Label>
				<Textarea
					id="test-input"
					bind:value={newTestCaseInput}
					placeholder="Enter test input..."
					rows={3}
					class="mt-1"
				/>
			</div>
			<div>
				<Label for="test-output">Expected Output</Label>
				<Textarea
					id="test-output"
					bind:value={newTestCaseOutput}
					placeholder="Enter expected output..."
					rows={3}
					class="mt-1"
				/>
			</div>
		</div>

		<div class="flex gap-2 pt-6">
			<Button variant="outline" onclick={handleCancel}>
				Cancel
			</Button>
			<Button onclick={handleAddTestCase} disabled={isLoading || !isFormValid}>
				{#if isLoading}
					<div
						class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					></div>
				{/if}
				Add Test Case
			</Button>
		</div>
	</Sheet.Content>
</Sheet.Root>
