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
		MessageCircle,
		ArrowRight
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { toggleMode } from 'mode-watcher';
	import { authClient } from '$lib/auth-client';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Card, CardTitle, CardHeader, CardDescription } from '$lib/components/ui/card';

	const session = authClient.useSession();

	const handleGoogleAuth = async () => {
		await authClient.signIn.social({
			provider: 'google',
			callbackURL: '/dashboard'
		});
	};

	const handleContinueToDashboard = () => {
		goto('/dashboard');
	};

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
				<div class="flex justify-center">
					{#if $session.isPending}
						<Skeleton class="h-[60px] w-[240px] rounded-lg" />
					{:else if $session.data?.user}
						<Button size="lg" class="px-6 py-6 text-lg" onclick={handleContinueToDashboard}>
							Continue to Dashboard
							<ArrowRight class="mr-3 size-5" />
						</Button>
					{:else}
						<Button
							variant="secondary"
							size="lg"
							class="px-8 py-6 text-lg"
							onclick={handleGoogleAuth}
						>
							<svg class="mr-3 size-5" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							Sign in with Google
						</Button>
					{/if}
				</div>
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
										<svelte:component this={feature.icon} class="size-5 text-primary" />
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
