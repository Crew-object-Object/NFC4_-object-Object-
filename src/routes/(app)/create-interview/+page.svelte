<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Calendar } from '$lib/components/ui/calendar';
	import * as Popover from '$lib/components/ui/popover';
	import {
		Calendar as CalendarIcon,
		Clock,
		User,
		FileText,
		CheckCircle,
		AlertCircle
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import {
		DateFormatter,
		type DateValue,
		getLocalTimeZone,
		parseDate,
		today
	} from '@internationalized/date';
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { goto } from '$app/navigation';

	const df = new DateFormatter('en-US', {
		dateStyle: 'medium'
	});

	// Type definitions based on Prisma schema
	type User = {
		id: string;
		name: string;
		email: string;
		role: 'Interviewer' | 'Interviewee';
	};

	type IntervieweeDisplay = {
		id: string;
		name: string;
		email: string;
		displayName: string;
	};

	// Form state
	let intervieweeId = $state('');
	let startDate = $state<DateValue | undefined>();
	let startTime = $state('');
	let endDate = $state<DateValue | undefined>();
	let endTime = $state('');
	let interviewTitle = $state('');
	let interviewDescription = $state('');

	// UI state
	let interviewees = $state<IntervieweeDisplay[]>([]);
	let loading = $state(false);
	let submitting = $state(false);
	let success = $state(false);
	let error = $state('');

	// Form validation
	let errors = $state({
		intervieweeId: '',
		startDateTime: '',
		endDateTime: '',
		interviewTitle: '',
		interviewDescription: ''
	});

	// Popover refs
	let startDatePopoverRef = $state<HTMLElement | null>(null);
	let endDatePopoverRef = $state<HTMLElement | null>(null);

	// Derived value for select trigger content
	const triggerContent = $derived(
		interviewees.find((i) => i.id === intervieweeId)?.displayName ?? 'Choose an interviewee'
	);

	// Get minimum dates
	const minDate = $derived(today(getLocalTimeZone()));
	const minEndDate = $derived(startDate || minDate);

	onMount(async () => {
		await fetchInterviewees();
	});

	async function fetchInterviewees() {
		loading = true;
		try {
			const response = await fetch('/api/get-interviewees');
			const data = await response.json();

			if (data.success) {
				interviewees = data.data.map((user: User) => ({
					id: user.id,
					name: user.name,
					email: user.email,
					displayName: `${user.name} (${user.email})`
				}));
			} else {
				error = 'Failed to load interviewees';
			}
		} catch (err) {
			error = 'Failed to load interviewees';
			console.error(err);
		} finally {
			loading = false;
		}
	}

	function validateForm(): boolean {
		errors = {
			intervieweeId: '',
			startDateTime: '',
			endDateTime: '',
			interviewTitle: '',
			interviewDescription: ''
		};

		let isValid = true;

		if (!intervieweeId) {
			errors.intervieweeId = 'Please select an interviewee';
			isValid = false;
		}

		if (!startDate || !startTime) {
			errors.startDateTime = 'Please select start date and time';
			isValid = false;
		}

		if (!endDate || !endTime) {
			errors.endDateTime = 'Please select end date and time';
			isValid = false;
		}

		if (!interviewTitle.trim()) {
			errors.interviewTitle = 'Interview title is required';
			isValid = false;
		}

		if (!interviewDescription.trim()) {
			errors.interviewDescription = 'Interview description is required';
			isValid = false;
		}

		// Validate that end time is after start time
		if (startDate && startTime && endDate && endTime) {
			const startDateTime = new Date(`${startDate.toString()}T${startTime}`);
			const endDateTime = new Date(`${endDate.toString()}T${endTime}`);

			if (endDateTime <= startDateTime) {
				errors.endDateTime = 'End time must be after start time';
				isValid = false;
			}

			// Validate that start time is in the future
			if (startDateTime <= new Date()) {
				errors.startDateTime = 'Start time must be in the future';
				isValid = false;
			}
		}

		return isValid;
	}

	async function handleSubmit() {
		if (!validateForm()) {
			return;
		}

		submitting = true;
		error = '';
		success = false;

		try {
			const startDateTime = `${startDate!.toString()}T${startTime}`;
			const endDateTime = `${endDate!.toString()}T${endTime}`;

			const response = await fetch('/api/interviews', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					intervieweeId,
					startTime: startDateTime,
					endTime: endDateTime,
					interviewTitle: interviewTitle.trim(),
					interviewDescription: interviewDescription.trim()
				})
			});

			const data = await response.json();

			if (data.success) {
				goto('/dashboard');
				success = true;
				// Reset form
				intervieweeId = '';
				startDate = undefined;
				startTime = '';
				endDate = undefined;
				endTime = '';
				interviewTitle = '';
				interviewDescription = '';
			} else {
				error = data.error || 'Failed to create interview';
			}
		} catch (err) {
			error = 'Failed to create interview';
			console.error(err);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="container mx-auto max-w-4xl space-y-8 p-6">
	<div class="space-y-2">
		<h1 class="text-3xl font-bold tracking-tight">Schedule Interview</h1>
		<p class="text-muted-foreground">Create a new interview session with an interviewee</p>
	</div>

	{#if success}
		<Card class="border-green-200 bg-green-50">
			<CardContent class="pt-6">
				<div class="flex items-center space-x-2 text-green-800">
					<CheckCircle class="h-5 w-5" />
					<p class="font-medium">Interview scheduled successfully!</p>
				</div>
			</CardContent>
		</Card>
	{/if}

	{#if error}
		<Card class="border-red-200 bg-red-50">
			<CardContent class="pt-6">
				<div class="flex items-center space-x-2 text-red-800">
					<AlertCircle class="h-5 w-5" />
					<p class="font-medium">{error}</p>
				</div>
			</CardContent>
		</Card>
	{/if}

	<Card>
		<CardHeader>
			<CardTitle class="flex items-center space-x-2">
				<CalendarIcon class="h-5 w-5" />
				<span>Interview Details</span>
			</CardTitle>
			<CardDescription>Fill in the interview information and schedule</CardDescription>
		</CardHeader>
		<CardContent class="space-y-6">
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Interviewee Selection -->
				<div class="space-y-2">
					<Label for="interviewee" class="flex items-center space-x-2">
						<User class="h-4 w-4" />
						<span>Select Interviewee</span>
					</Label>
					{#if loading}
						<div class="flex h-10 items-center justify-center rounded-md border">
							<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
							<span class="ml-2 text-sm text-muted-foreground">Loading interviewees...</span>
						</div>
					{:else}
						<Select.Root type="single" name="interviewee" bind:value={intervieweeId}>
							<Select.Trigger class={cn('w-full', errors.intervieweeId && 'border-red-500')}>
								{intervieweeId
									? interviewees.find((i) => i.id === intervieweeId)?.displayName
									: 'Choose an interviewee'}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									{#each interviewees as interviewee (interviewee.id)}
										<Select.Item value={interviewee.id} label={interviewee.displayName}>
											<div class="flex flex-col">
												<span class="font-medium">{interviewee.name}</span>
												<span class="text-sm text-muted-foreground">{interviewee.email}</span>
											</div>
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					{/if}
					{#if errors.intervieweeId}
						<p class="text-sm text-red-500">{errors.intervieweeId}</p>
					{/if}
				</div>

				<!-- Date and Time Selection -->
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
					<!-- Start Date/Time -->
					<div class="space-y-4">
						<Label class="flex items-center space-x-2">
							<Clock class="h-4 w-4" />
							<span>Start Date & Time</span>
						</Label>
						<div class="space-y-3">
							<div>
								<Label for="startDate" class="text-sm">Date</Label>
								<Popover.Root>
									<Popover.Trigger
										class={cn(
											buttonVariants({
												variant: 'outline',
												class: 'w-full justify-start text-left font-normal'
											}),
											!startDate && 'text-muted-foreground',
											errors.startDateTime && 'border-red-500'
										)}
									>
										<CalendarIcon class="mr-2 h-4 w-4" />
										{startDate
											? df.format(startDate.toDate(getLocalTimeZone()))
											: 'Pick start date'}
									</Popover.Trigger>
									<Popover.Content bind:ref={startDatePopoverRef} class="w-auto p-0">
										<Calendar
											type="single"
											bind:value={startDate}
											minValue={minDate}
											initialFocus
										/>
									</Popover.Content>
								</Popover.Root>
							</div>
							<div>
								<Label for="startTime" class="text-sm">Time</Label>
								<Input
									id="startTime"
									type="time"
									bind:value={startTime}
									class={cn(errors.startDateTime && 'border-red-500')}
								/>
							</div>
						</div>
						{#if errors.startDateTime}
							<p class="text-sm text-red-500">{errors.startDateTime}</p>
						{/if}
					</div>

					<!-- End Date/Time -->
					<div class="space-y-4">
						<Label class="flex items-center space-x-2">
							<Clock class="h-4 w-4" />
							<span>End Date & Time</span>
						</Label>
						<div class="space-y-3">
							<div>
								<Label for="endDate" class="text-sm">Date</Label>
								<Popover.Root>
									<Popover.Trigger
										class={cn(
											buttonVariants({
												variant: 'outline',
												class: 'w-full justify-start text-left font-normal'
											}),
											!endDate && 'text-muted-foreground',
											errors.endDateTime && 'border-red-500'
										)}
									>
										<CalendarIcon class="mr-2 h-4 w-4" />
										{endDate ? df.format(endDate.toDate(getLocalTimeZone())) : 'Pick end date'}
									</Popover.Trigger>
									<Popover.Content bind:ref={endDatePopoverRef} class="w-auto p-0">
										<Calendar
											type="single"
											bind:value={endDate}
											minValue={minEndDate}
											initialFocus
										/>
									</Popover.Content>
								</Popover.Root>
							</div>
							<div>
								<Label for="endTime" class="text-sm">Time</Label>
								<Input
									id="endTime"
									type="time"
									bind:value={endTime}
									class={cn(errors.endDateTime && 'border-red-500')}
								/>
							</div>
						</div>
						{#if errors.endDateTime}
							<p class="text-sm text-red-500">{errors.endDateTime}</p>
						{/if}
					</div>
				</div>

				<!-- Interview Title -->
				<div class="space-y-2">
					<Label for="title" class="flex items-center space-x-2">
						<FileText class="h-4 w-4" />
						<span>Interview Title</span>
					</Label>
					<Input
						id="title"
						type="text"
						placeholder="e.g., Frontend Developer Interview"
						bind:value={interviewTitle}
						class={cn(errors.interviewTitle && 'border-red-500')}
					/>
					{#if errors.interviewTitle}
						<p class="text-sm text-red-500">{errors.interviewTitle}</p>
					{/if}
				</div>

				<!-- Interview Description -->
				<div class="space-y-2">
					<Label for="description">Interview Description</Label>
					<Textarea
						id="description"
						placeholder="Describe the interview format, topics to be covered, and any special instructions..."
						bind:value={interviewDescription}
						class={cn('min-h-[120px]', errors.interviewDescription && 'border-red-500')}
					/>
					{#if errors.interviewDescription}
						<p class="text-sm text-red-500">{errors.interviewDescription}</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<div class="flex justify-end space-x-4 pt-4">
					<Button type="button" variant="outline" onclick={() => window.history.back()}>
						Cancel
					</Button>
					<Button type="submit" disabled={submitting}>
						{#if submitting}
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
						{/if}
						{submitting ? 'Scheduling...' : 'Schedule Interview'}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</div>
