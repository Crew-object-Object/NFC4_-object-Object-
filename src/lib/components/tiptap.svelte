<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import CodeIcon from '@lucide/svelte/icons/code';
	import * as Select from '$lib/components/ui/select/index.js';
	import Collaboration from '@tiptap/extension-collaboration';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import { common, createLowlight } from 'lowlight';
	import * as Y from 'yjs';
	import TiptapCollabProvider from '@tiptap-pro/provider';
	import { authClient } from '../auth-client';
	import { PencilIcon } from 'lucide-svelte';

	// Props
	interface Props {
		roomId?: string;
		onContentChange?: (content: string) => void;
		onLanguageChange?: (languageId: string) => void;
		isInterviewee?: boolean;
		onPasteDetected?: () => void;
	}

	let {
		roomId = 'default',
		onContentChange,
		onLanguageChange,
		isInterviewee = false,
		onPasteDetected
	}: Props = $props();

	let element: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	let data = authClient.useSession();
	let provider = $state<TiptapCollabProvider | null>(null);
	let currentRoomId = $state<string | null>(null);
	let isSettingUpCollaboration = $state(false);
	const doc = new Y.Doc();
	const lowlight = createLowlight(common);

	// Language state management
	let selectedLanguage = $state<string>('10');

	// Available languages for syntax highlighting
	const availableLanguages = [
		{ value: '10', label: 'Python' },
		{ value: '4', label: 'Java' },
		{ value: '2', label: 'C++' }
	];

	// Function to get the text content from the editor
	function getTextContent(): string {
		if (!editor) return '';
		return editor.getText();
	}

	// Function to get only code block content
	function getCodeContent(): string {
		if (!editor) return '';

		const doc = editor.state.doc;
		let codeContent = '';

		doc.descendants((node) => {
			if (node.type.name === 'codeBlock') {
				codeContent += node.textContent;
				if (codeContent && !codeContent.endsWith('\n')) {
					codeContent += '\n';
				}
			}
			return true;
		});

		return codeContent.trim();
	}

	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				StarterKit.configure({
					codeBlock: false // Disable default code block to use CodeBlockLowlight
				}),
				CodeBlockLowlight.configure({
					lowlight,
					defaultLanguage: selectedLanguage
				}),
				Collaboration.configure({
					document: doc // Configure Y.Doc for collaboration
				})
			],
			content: '<p>Hello World! 🌍️ </p>',
			onTransaction: () => {
				const currentEditor = editor;
				editor = null;
				editor = currentEditor;

				// Call the content change callback with code content
				if (onContentChange) {
					const codeContent = getCodeContent();
					onContentChange(codeContent);
				}
			},
			editorProps: {
				handlePaste: (view, event, slice) => {
					// Detect paste events for interviewees
					if (isInterviewee && onPasteDetected) {
						const pastedContent = slice.content.textBetween(0, slice.content.size);

						// Only trigger if substantial content is pasted (more than 10 characters)
						// This helps avoid false positives for small pastes like single words
						if (pastedContent.trim().length > 10) {
							console.log('Paste detected:', {
								length: pastedContent.length,
								content: pastedContent.substring(0, 100) + (pastedContent.length > 100 ? '...' : '')
							});
							onPasteDetected();
						}
					}

					// Return false to allow default paste behavior
					return false;
				}
			}
		});

		// Initialize parent with default language
		if (onLanguageChange) {
			onLanguageChange(selectedLanguage);
		}
	});

	onDestroy(() => {
		if (provider) {
			provider.destroy();
		}
		if (editor) {
			editor.destroy();
		}
	});

	// Reactive getters for active states
	const isBoldActive = $derived(editor?.isActive('bold') ?? false);
	const isItalicActive = $derived(editor?.isActive('italic') ?? false);
	const isStrikeActive = $derived(editor?.isActive('strike') ?? false);
	const isCodeBlockActive = $derived(editor?.isActive('codeBlock') ?? false);

	// Function to handle language change
	function handleLanguageChange(value: string) {
		selectedLanguage = value;
		if (editor && isCodeBlockActive) {
			editor.chain().focus().updateAttributes('codeBlock', { language: value }).run();
		}
		// Call the parent callback with the selected language ID
		if (onLanguageChange) {
			onLanguageChange(value);
		}
	}

	// Update selected language when code block selection changes
	$effect(() => {
		if (editor && isCodeBlockActive) {
			const attrs = editor.getAttributes('codeBlock');
			if (attrs.language && attrs.language !== selectedLanguage) {
				selectedLanguage = attrs.language;
			}
		}
	});

	$effect(() => {
		const sessionData = $data.data;

		// Only setup collaboration if we have session data, a roomId, and it's different from current
		if (!sessionData || !roomId || roomId === currentRoomId || isSettingUpCollaboration) {
			return;
		}

		console.log('Setting up collaboration for room:', roomId);
		isSettingUpCollaboration = true;

		// Clean up existing provider
		if (provider) {
			provider.destroy();
			provider = null;
		}

		async function setupCollaboration() {
			try {
				// Try to generate TipTap token from server
				const response = await fetch('/api/tiptap-token', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ roomId })
				});

				if (!response.ok) {
					throw new Error('Failed to get token');
				}

				const { token } = await response.json();

				if (!token) {
					throw new Error('No token received');
				}

				// Create new provider with room-specific name and proper token
				const newProvider = new TiptapCollabProvider({
					name: `room-${roomId}`,
					appId: 'jkvv46ek',
					token: token,
					document: doc
				});

				// Only set provider if we're still working with the same room
				if (roomId === currentRoomId) {
					provider = newProvider;
					console.log('Collaboration provider created with authentication for room:', roomId);
				} else {
					// Room changed while we were setting up, destroy the provider
					newProvider.destroy();
				}
			} catch (error) {
				console.warn(
					'Failed to set up authenticated collaboration, falling back to basic mode:',
					error
				);

				// Fallback: create provider without authentication (for development)
				const newProvider = new TiptapCollabProvider({
					name: `room-${roomId}`,
					appId: 'jkvv46ek',
					token: `fallback-${roomId}-${Date.now()}`, // Use a unique fallback token
					document: doc
				});

				// Only set provider if we're still working with the same room
				if (roomId === currentRoomId) {
					provider = newProvider;
					console.log('Collaboration provider created in fallback mode for room:', roomId);
				} else {
					// Room changed while we were setting up, destroy the provider
					newProvider.destroy();
				}
			} finally {
				isSettingUpCollaboration = false;
			}
		}

		// Update current room and setup collaboration
		currentRoomId = roomId;
		setupCollaboration();

		// Cleanup function
		return () => {
			if (provider && currentRoomId === roomId) {
				provider.destroy();
				provider = null;
			}
		};
	});
</script>

{#if editor}
	<div class="mb-2 flex items-center gap-1">
		<!-- Code Block Toggle -->
		<div class="flex w-full items-center gap-1">
			<Toggle
				pressed={isCodeBlockActive}
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				variant="outline"
				size="sm"
				aria-label="Toggle code block"
			>
				<CodeIcon size={16} />
			</Toggle>

			{#if isCodeBlockActive}
				<Select.Root type="single" value={selectedLanguage} onValueChange={handleLanguageChange}>
					<Select.Trigger class="h-8 w-[140px] text-xs">
						<span class="truncate">
							{availableLanguages.find((lang) => lang.value === selectedLanguage)?.label ||
								'Select Language'}
						</span>
					</Select.Trigger>
					<Select.Content class="max-h-[200px]">
						{#each availableLanguages as language}
							<Select.Item value={language.value}>
								{language.label}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>

		<Separator orientation="vertical" class="h-6" />

		<!-- Text Style Toggles -->
		<div class="flex items-center gap-1">
			<Toggle
				pressed={isBoldActive}
				onclick={() => editor?.chain().focus().toggleBold().run()}
				variant="outline"
				size="sm"
				aria-label="Toggle bold"
			>
				<BoldIcon size={16} />
			</Toggle>
			<Toggle
				pressed={isItalicActive}
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				variant="outline"
				size="sm"
				aria-label="Toggle italic"
			>
				<ItalicIcon size={16} />
			</Toggle>
			<Toggle
				pressed={isStrikeActive}
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				variant="outline"
				size="sm"
				aria-label="Toggle strikethrough"
			>
				<StrikethroughIcon size={16} />
			</Toggle>
		</div>
	</div>
{/if}

<div
	bind:this={element}
	class="prose min-h-64 max-w-none rounded-md border p-4 py-0 dark:prose-invert [&_.ProseMirror]:m-0 [&_.ProseMirror]:border-none [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none"
></div>

<style lang="postcss">
	:global(.ProseMirror) {
		outline: none !important;
		border: none !important;
		padding: 0 !important;
		margin: 0 !important;
		margin-top: -0.75rem !important; /* Adjusted for better spacing */
		margin-bottom: -0.75rem !important; /* Adjusted for better spacing */
		min-height: inherit;
	}

	:global(.ProseMirror:focus) {
		outline: none !important;
		box-shadow: none !important;
		border: none !important;
	}

	/* Syntax highlighting styles */
	:global(.ProseMirror pre) {
		background: hsl(var(--muted));
		border-radius: 0.5rem;
		color: hsl(var(--muted-foreground));
		font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
		padding: 0.75rem 1rem;
		white-space: pre-wrap;
	}

	:global(.ProseMirror pre code) {
		background: none;
		color: inherit;
		font-size: 0.8rem;
		padding: 0;
	}

	/* Highlight.js token styles */
	:global(.hljs-comment),
	:global(.hljs-quote) {
		color: #6a737d;
		font-style: italic;
	}

	:global(.hljs-keyword),
	:global(.hljs-selector-tag),
	:global(.hljs-addition) {
		color: #d73a49;
	}

	:global(.hljs-number),
	:global(.hljs-string),
	:global(.hljs-meta .hljs-meta-string),
	:global(.hljs-literal),
	:global(.hljs-doctag),
	:global(.hljs-regexp) {
		color: #032f62;
	}

	:global(.hljs-title),
	:global(.hljs-section),
	:global(.hljs-name),
	:global(.hljs-selector-id),
	:global(.hljs-selector-class) {
		color: #6f42c1;
	}

	:global(.hljs-attribute),
	:global(.hljs-attr),
	:global(.hljs-variable),
	:global(.hljs-template-variable),
	:global(.hljs-class .hljs-title),
	:global(.hljs-type) {
		color: #e36209;
	}

	:global(.hljs-symbol),
	:global(.hljs-bullet),
	:global(.hljs-subst),
	:global(.hljs-meta),
	:global(.hljs-meta .hljs-keyword),
	:global(.hljs-selector-attr),
	:global(.hljs-selector-pseudo),
	:global(.hljs-link) {
		color: #005cc5;
	}

	:global(.hljs-built_in),
	:global(.hljs-deletion) {
		color: #b31d28;
	}

	/* Dark mode adjustments */
	:global(.dark .hljs-comment),
	:global(.dark .hljs-quote) {
		color: #8b949e;
	}

	:global(.dark .hljs-keyword),
	:global(.dark .hljs-selector-tag),
	:global(.dark .hljs-addition) {
		color: #ff7b72;
	}

	:global(.dark .hljs-number),
	:global(.dark .hljs-string),
	:global(.dark .hljs-meta .hljs-meta-string),
	:global(.dark .hljs-literal),
	:global(.dark .hljs-doctag),
	:global(.dark .hljs-regexp) {
		color: #a5d6ff;
	}

	:global(.dark .hljs-title),
	:global(.dark .hljs-section),
	:global(.dark .hljs-name),
	:global(.dark .hljs-selector-id),
	:global(.dark .hljs-selector-class) {
		color: #d2a8ff;
	}

	:global(.dark .hljs-attribute),
	:global(.dark .hljs-attr),
	:global(.dark .hljs-variable),
	:global(.dark .hljs-template-variable),
	:global(.dark .hljs-class .hljs-title),
	:global(.dark .hljs-type) {
		color: #ffa657;
	}

	:global(.dark .hljs-symbol),
	:global(.dark .hljs-bullet),
	:global(.dark .hljs-subst),
	:global(.dark .hljs-meta),
	:global(.dark .hljs-meta .hljs-keyword),
	:global(.dark .hljs-selector-attr),
	:global(.dark .hljs-selector-pseudo),
	:global(.dark .hljs-link) {
		color: #79c0ff;
	}

	:global(.dark .hljs-built_in),
	:global(.dark .hljs-deletion) {
		color: #ffa198;
	}
</style>
