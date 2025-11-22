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




