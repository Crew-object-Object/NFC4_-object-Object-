import { writable } from 'svelte/store';

export type User = {
	id: string;
	email: string;
	name?: string;
	createdAt: Date;
	updatedAt: Date;
	image?: string | null;
	emailVerified: boolean;
};

export type AuthState = {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
};

const authStore = writable<AuthState>({
	user: null,
	isLoading: false,
	isAuthenticated: false
});

export function setAuth(user: User | null) {
	authStore.set({
		user,
		isLoading: false,
		isAuthenticated: !!user
	});
}

export function useAuth() {
	return authStore;
}
