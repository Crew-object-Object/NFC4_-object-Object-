<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import Collaboration from '@tiptap/extension-collaboration';
	import * as Y from 'yjs';

	let element: HTMLDivElement;
	let editor = $state<Editor | null>(null);

	const doc = new Y.Doc();
	
	onMount(() => {
		editor = new Editor({
			element: element,
			extensions: [
				StarterKit,
				Collaboration.configure({
					document: doc // Configure Y.Doc for collaboration
				})
			],
			content: '<p>Hello World! 🌍️ </p>',
			onTransaction: () => {
				const currentEditor = editor;
				editor = null;
				editor = currentEditor;
			}
		});
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	// Reactive getters for active states
	const isH1Active = $derived(editor?.isActive('heading', { level: 1 }) ?? false);
	const isH2Active = $derived(editor?.isActive('heading', { level: 2 }) ?? false);
	const isParagraphActive = $derived(editor?.isActive('paragraph') ?? false);
	const isBoldActive = $derived(editor?.isActive('bold') ?? false);
	const isItalicActive = $derived(editor?.isActive('italic') ?? false);
	const isStrikeActive = $derived(editor?.isActive('strike') ?? false);
</script>

{#if editor}
	<div class="flex items-center gap-1 p-2">
		<!-- Text Format Toggles -->
		<div class="flex items-center gap-1">
			<Toggle
				pressed={isH1Active}
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				variant="outline"
				size="sm"
				aria-label="Toggle heading 1"
			>
				H1
			</Toggle>
			<Toggle
				pressed={isH2Active}
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				variant="outline"
				size="sm"
				aria-label="Toggle heading 2"
			>
				H2
			</Toggle>
			<Toggle
				pressed={isParagraphActive}
				onclick={() => editor?.chain().focus().setParagraph().run()}
				variant="outline"
				size="sm"
				aria-label="Set paragraph"
			>
				P
			</Toggle>
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
	class="prose min-h-64 max-w-none rounded-md border p-4 dark:prose-invert [&_.ProseMirror]:m-0 [&_.ProseMirror]:border-none [&_.ProseMirror]:p-0 [&_.ProseMirror]:outline-none"
></div>

<style>
	:global(.ProseMirror) {
		outline: none !important;
		border: none !important;
		padding: 0 !important;
		margin: 0 !important;
		min-height: inherit;
	}

	:global(.ProseMirror:focus) {
		outline: none !important;
		box-shadow: none !important;
		border: none !important;
	}
</style>
