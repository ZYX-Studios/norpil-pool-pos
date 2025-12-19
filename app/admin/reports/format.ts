// Shared formatting helpers for the admin reports views.
// We keep these small and generic so they can be reused across sections.

export function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}

export function formatPercent(n: number) {
	return `${n.toFixed(1)}%`;
}

export function formatCategoryLabel(category: string) {
	switch (category) {
		case "FOOD":
			return "Food";
		case "DRINK":
			return "Beverages";
		case "TABLE_TIME":
			return "Tables";
		default:
			return category;
	}
}

export function formatDateTime(dateStr: string) {
	return new Date(dateStr).toLocaleString("en-US", {
		timeZone: "Asia/Manila",
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "numeric",
		hour12: true,
	});
}

export function formatTime(dateStr: string) {
	return new Date(dateStr).toLocaleTimeString("en-US", {
		timeZone: "Asia/Manila",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}

export function formatDate(dateStr: string | Date, options?: Intl.DateTimeFormatOptions) {
	return new Date(dateStr).toLocaleDateString("en-US", {
		timeZone: "Asia/Manila",
		...options,
	});
}




