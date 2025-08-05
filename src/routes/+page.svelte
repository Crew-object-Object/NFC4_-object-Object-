<script lang="ts">
	import {
		Bot,
		Zap,
		Code,
		Play,
		Users,
		Shield,
		Github,
		History,
		FileText,
		Smartphone,
		MessageCircle
	} from 'lucide-svelte';
	import { toggleMode } from 'mode-watcher';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Card, CardTitle, CardHeader, CardDescription } from '$lib/components/ui/card';

	const features = [
		{
			icon: Code,
			title: 'Real-Time Code Sharing',
			description: 'Syntax highlighting for popular languages (Python, JavaScript, C++, Java, etc.)'
		},
		{
			icon: Play,
			title: 'Live Execution Environment',
			description: 'Support for compiling and executing code with input/output console'
		},
		{
			icon: MessageCircle,
			title: 'Built-in Chat & Video Integration',
			description: 'Text or video chat for real-time communication during sessions'
		},
		{
			icon: FileText,
			title: 'Prompt Window',
			description: 'For interviewers to share problems and test cases'
		},
		{
			icon: History,
			title: 'Code Playback & History',
			description: 'Replay code sessions to review logic and edits'
		},
		{
			icon: Shield,
			title: 'Role-Based Access',
			description: 'Interviewer/interviewee modes, admin controls'
		},
		{
			icon: Users,
			title: 'Multi-file Support',
			description: 'For modular projects and larger exercises'
		},
		{
			icon: Smartphone,
			title: 'Mobile Compatibility',
			description: 'Lite interface for tablets/phones'
		},
		{
			icon: Bot,
			title: 'Agentic AI Assistants',
			description: 'Intelligent coding suggestions and feedback during collaborative sessions'
		}
	];

	const useCases = [
		{
			title: 'Live Coding Interviews',
			description: 'Robust, real-time platform tailored for interviewers and bootcamps',
			icon: Users
		},
		{
			title: 'Collaborative Programming',
			description: 'Remote team coding with integrated communication features',
			icon: Code
		},
		{
			title: 'Learning & Training',
			description: 'Interview-ready tool for universities, startups, and training programs',
			icon: Bot
		}
	];
</script>

<div class="min-h-screen">
	<header
		class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	>
		<div class="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
			<div class="flex items-center gap-2">
				<Code class="size-8 text-primary" />
				<span
					class="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-2xl font-bold"
					>CodeCollab</span
				>
			</div>
			<div class="flex items-center gap-8">
				<nav class="hidden items-center gap-8 md:flex">
					<a
						href="#features"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>Features</a
					>
					<a
						href="#use-cases"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>Use Cases</a
					>
				</nav>
				<Button onclick={toggleMode} variant="outline" size="icon">
					<SunIcon
						class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
					/>
					<MoonIcon
						class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
					/>
					<span class="sr-only">Toggle theme</span>
				</Button>
			</div>
		</div>
	</header>

	<main>
		<section class="py-20 md:py-32">
			<div class="container mx-auto max-w-6xl px-4 text-center">
				<Badge variant="default" class="mb-6">
					<Zap class="mr-2 size-4" />
					Real-Time Coding Platform
				</Badge>
				<h1
					class="mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight md:text-6xl"
				>
					CodeCollab
				</h1>
				<p class="mx-auto mb-8 max-w-4xl text-xl leading-relaxed text-muted-foreground">
					Lightweight, browser-based real-time collaborative coding platform with integrated chat
					and video features, tailored for interviews and learning. An intuitive, interview-ready
					code collaboration tool for universities, startups, and training programs.
				</p>
			</div>
		</section>

		<section id="features" class="bg-muted/30 py-20">
			<div class="container mx-auto max-w-6xl px-4">
				<div class="mb-16 text-center">
					<h2 class="mb-4 text-3xl font-bold md:text-4xl">Key Functionalities</h2>
					<p class="mx-auto max-w-2xl text-xl text-muted-foreground">
						Everything you need for real-time collaborative coding
					</p>
				</div>
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each features as feature}
						<Card class="border-border/50 transition-all duration-300 hover:shadow-md">
							<CardHeader class="pb-4">
								<div class="mb-3 flex items-center gap-3">
									<div class="rounded-lg bg-primary/10 p-2">
										<svelte:component this={feature.icon} class="h-5 w-5 text-primary" />
									</div>
									<CardTitle class="text-lg">{feature.title}</CardTitle>
								</div>
								<CardDescription class="text-sm leading-relaxed"
									>{feature.description}</CardDescription
								>
							</CardHeader>
						</Card>
					{/each}
				</div>
			</div>
		</section>

		<section id="use-cases" class="bg-background py-20">
			<div class="container mx-auto max-w-6xl px-4">
				<div class="mb-16 text-center">
					<h2 class="mb-4 text-3xl font-bold md:text-4xl">Perfect For</h2>
					<p class="mx-auto max-w-2xl text-xl text-muted-foreground">
						Designed for interviews, team collaboration, and learning environments
					</p>
				</div>
				<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
					{#each useCases as useCase}
						<Card class="border-border/50 text-center transition-all duration-300 hover:shadow-md">
							<CardHeader>
								<div
									class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"
								>
									<svelte:component this={useCase.icon} class="h-6 w-6 text-primary" />
								</div>
								<CardTitle class="mb-2 text-xl">{useCase.title}</CardTitle>
								<CardDescription class="text-base">{useCase.description}</CardDescription>
							</CardHeader>
						</Card>
					{/each}
				</div>
			</div>
		</section>
	</main>

	<footer class="border-t bg-muted/30 py-12">
		<div class="container mx-auto max-w-6xl px-4">
			<div class="flex flex-col items-center justify-between md:flex-row">
				<div class="mb-4 flex items-center gap-2 md:mb-0">
					<Code class="h-6 w-6 text-primary" />
					<span class="text-lg font-bold">CodeCollab</span>
				</div>
				<div class="flex items-center gap-6">
					<Button variant="ghost" size="sm">
						<a
							target="_blank"
							aria-label="GitHub"
							rel="noopener noreferrer"
							href="https://github.com/Crew-object-Object/NFC4_-object-Object-"
						>
							<Github class="size-4" />
						</a>
					</Button>
				</div>
			</div>
			<Separator class="my-6" />
			<div class="text-center text-sm text-muted-foreground">
				<p>&copy; 2025 CodeCollab. Real-time coding collaboration platform.</p>
			</div>
		</div>
	</footer>
</div>
