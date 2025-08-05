import { createAuthClient } from 'better-auth/svelte';
import { PUBLIC_BETTER_AUTH_BASE_URL } from '$env/static/public';

export const authClient = createAuthClient({
	baseURL: PUBLIC_BETTER_AUTH_BASE_URL
});

export const { signIn, signUp, signOut, useSession } = authClient;
