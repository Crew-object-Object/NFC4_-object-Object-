import type { auth } from './auth';
import { createAuthClient } from 'better-auth/svelte';
import { PUBLIC_BETTER_AUTH_BASE_URL } from '$env/static/public';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: PUBLIC_BETTER_AUTH_BASE_URL,
	plugins: [inferAdditionalFields<typeof auth>()]
});

export const { signIn, signUp, signOut, useSession } = authClient;
