<script>
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

    let code = `print("Hello, World!")

# Example: Read input and process it
# name = input("Enter your name: ")
# print(f"Hello, {name}!")`;

    let input = '';
    let languageId = '10'; // Python (3.8.1)
    let result = null;
    let loading = false;

    async function submitCode() {
        loading = true;
        result = null;

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    language_id: languageId,
                    input
                })
            });

            result = await response.json();
        } catch (error) {
            console.error('Error submitting code:', error);
            result = { error: 'Failed to submit code' };
        } finally {
            loading = false;
        }
    }
</script>

<div class="container mx-auto space-y-6 p-6">
    <h1 class="text-3xl font-bold">Python Code Judge Tester</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Python Code Input</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div>
                        <label class="mb-2 block text-sm font-medium">Language</label>
                        <div class="rounded bg-muted p-2 text-sm">Python (3.8.1)</div>
                    </div>

                    <div>
                        <label class="mb-2 block text-sm font-medium">Source Code</label>
                        <Textarea
                            bind:value={code}
                            placeholder="Enter your Python code here..."
                            class="min-h-[200px] font-mono text-sm"
                        />
                    </div>

                    <div>
                        <label class="mb-2 block text-sm font-medium">Input (stdin)</label>
                        <Textarea
                            bind:value={input}
                            placeholder="Enter input for your program..."
                            class="min-h-[100px]"
                        />
                    </div>

                    <Button onclick={submitCode} disabled={loading} class="w-full">
                        {loading ? 'Submitting...' : 'Submit Code'}
                    </Button>
                </CardContent>
            </Card>
        </div>

        <!-- Output Section -->
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Result</CardTitle>
                </CardHeader>
                <CardContent>
                    {#if loading}
                        <div class="flex items-center justify-center p-8">
                            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                            <span class="ml-2">Processing...</span>
                        </div>
                    {:else if result}
                        <div class="space-y-4">
                            <div>
                                <h3 class="mb-2 font-semibold">Status</h3>
                                <p class="rounded bg-muted p-2 text-sm">
                                    {result.status?.description || 'Unknown'}
                                </p>
                            </div>

                            {#if result.stdout}
                                <div>
                                    <h3 class="mb-2 font-semibold">Output</h3>
                                    <pre
                                        class="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{result.stdout}</pre>
                                </div>
                            {/if}

                            {#if result.stderr}
                                <div>
                                    <h3 class="mb-2 font-semibold text-destructive">Error</h3>
                                    <pre
                                        class="rounded bg-destructive/10 p-3 text-sm whitespace-pre-wrap text-destructive">{result.stderr}</pre>
                                </div>
                            {/if}

                            {#if result.compile_output}
                                <div>
                                    <h3 class="mb-2 font-semibold">Compile Output</h3>
                                    <pre
                                        class="rounded bg-muted p-3 text-sm whitespace-pre-wrap">{result.compile_output}</pre>
                                </div>
                            {/if}

                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="font-medium">Time:</span>
                                    {result.time || 'N/A'}s
                                </div>
                                <div>
                                    <span class="font-medium">Memory:</span>
                                    {result.memory || 'N/A'} KB
                                </div>
                            </div>
                        </div>
                    {:else}
                        <p class="text-muted-foreground">Submit your code to see the results</p>
                    {/if}
                </CardContent>
            </Card>
        </div>
    </div>
</div>