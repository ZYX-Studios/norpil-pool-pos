'use client';

import { useEffect } from "react";

/**
 * Small client-only component that registers the service worker.
 * - Kept separate from the main layout to keep concerns clear and files small.
 * - Runs once on mount and silently ignores errors (for example, during local dev).
 */
export function ServiceWorkerRegistrar() {
	useEffect(() => {
		// Service workers are only available in secure contexts (https or localhost).
		if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
			return;
		}

		// We keep the registration path simple: the file lives in /public/sw.js
		// so it is served from the site root as /sw.js.
		navigator.serviceWorker
			.register("/sw.js")
			.catch(() => {
				// In case of any registration error, we do not block the POS.
				// Offline features simply will not be available until it succeeds.
			});
	}, []);

	return null;
}




