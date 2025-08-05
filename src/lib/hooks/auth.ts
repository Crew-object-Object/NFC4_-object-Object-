import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { setAuth } from '$lib/hooks/use-auth';

export async function signOut() {
	const signOutPromise = new Promise(async (resolve, reject) => {
		try {
			await authClient.signOut();
			setAuth(null);
			resolve('Successfully logged out');
		} catch (error) {
			reject(error);
		}
	});

	toast.promise(signOutPromise, {
		loading: 'Signing out...',
		success: () => {
			goto('/auth');
			return 'Successfully signed out';
		},
		error: (error: unknown) =>
			`Error signing out: ${error instanceof Error ? error.message : 'Unknown error'}`
	});

	return signOutPromise;
}
