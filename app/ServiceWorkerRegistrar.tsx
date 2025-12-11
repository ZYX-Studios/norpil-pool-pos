'use client';

import { useEffect } from "react";

/**
 * Small client-only component that registers the service worker.
 * - Kept separate from the main layout to keep concerns clear and files small.
 * - Runs once on mount and silently ignores errors (for example, during local dev).
 */
export function ServiceWorkerRegistrar() {
	useEffect(() => {
		// We are removing offline support. To ensure no clients are stuck with
		// an old service worker, we explicitly unregister any that we find.
		if (typeof window !== "undefined" && "serviceWorker" in navigator) {
			navigator.serviceWorker.getRegistrations().then((registrations) => {
				for (const registration of registrations) {
					registration.unregister();
				}
			});
		}
	}, []);

	return null;
}





