import { auth } from '$lib/auth';
import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export async function handle({ event, resolve }) {
	return svelteKitHandler({ event, resolve, auth, building });
}
