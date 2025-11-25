import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { ReportData } from "../data";

// Register a font (optional, but good for consistent look)
// Using standard Helvetica for now to avoid loading issues, but can add custom fonts later.

const styles = StyleSheet.create({
	page: {
		flexDirection: "column",
		backgroundColor: "#FFFFFF",
		padding: 30,
		fontFamily: "Helvetica",
	},
	header: {
		marginBottom: 20,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
		paddingBottom: 10,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#111827",
	},
	subtitle: {
		fontSize: 12,
		color: "#6B7280",
		marginTop: 4,
	},
	section: {
		marginBottom: 15,
		padding: 10,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 8,
		color: "#374151",
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
		paddingBottom: 4,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 4,
	},
	label: {
		fontSize: 10,
		color: "#4B5563",
	},
	value: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827",
	},
	summaryBox: {
		backgroundColor: "#F9FAFB",
		padding: 10,
		borderRadius: 4,
		marginBottom: 20,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	summaryLabel: {
		fontSize: 12,
		color: "#4B5563",
	},
	summaryValue: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#111827",
	},
	footer: {
		position: "absolute",
		bottom: 30,
		left: 30,
		right: 30,
		textAlign: "center",
		fontSize: 8,
		color: "#9CA3AF",
		borderTopWidth: 1,
		borderTopColor: "#E5E7EB",
		paddingTop: 10,
	},
});

interface ExecutiveReportProps {
	data: ReportData;
	start: string;
	end: string;
}

const formatCurrency = (amount: number) => {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
	}).format(amount);
};

const formatPercent = (value: number) => {
	return `${value.toFixed(1)}%`;
};

export const ExecutiveReport = ({ data, start, end }: ExecutiveReportProps) => {
	const totalRevenue = Number(data.total ?? 0);
	const txArray = data.tx ?? [];
	const totalTransactions = txArray.length;
	const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

	const expenseArray = data.expenses ?? [];
	let totalExpenses = 0;
	for (const row of expenseArray) {
		totalExpenses += Number(row.amount ?? 0);
	}
	const netProfit = totalRevenue - totalExpenses;
	const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

	const startLabel = new Date(start).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const endLabel = new Date(end).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
    const rangeLabel = start === end ? startLabel : `${startLabel} – ${endLabel}`;


	return (
		<Document>
			<Page size="A4" style={styles.page}>
				<View style={styles.header}>
					<Text style={styles.title}>Executive Report</Text>
					<Text style={styles.subtitle}>Norpil Pool POS • {rangeLabel}</Text>
				</View>

				<View style={styles.summaryBox}>
					<Text style={{ ...styles.sectionTitle, marginBottom: 10 }}>Financial Summary</Text>
					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Total Revenue</Text>
						<Text style={styles.summaryValue}>{formatCurrency(totalRevenue)}</Text>
					</View>
					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Total Expenses</Text>
						<Text style={{ ...styles.summaryValue, color: "#EF4444" }}>
							{formatCurrency(totalExpenses)}
						</Text>
					</View>
					<View style={{ ...styles.summaryRow, borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 4 }}>
						<Text style={{ ...styles.summaryLabel, fontWeight: "bold" }}>Net Profit</Text>
						<Text style={{ ...styles.summaryValue, color: netProfit >= 0 ? "#10B981" : "#EF4444" }}>
							{formatCurrency(netProfit)}
						</Text>
					</View>
					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Net Margin</Text>
						<Text style={styles.summaryValue}>{formatPercent(netMargin)}</Text>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Operational Metrics</Text>
					<View style={styles.row}>
						<Text style={styles.label}>Total Transactions</Text>
						<Text style={styles.value}>{totalTransactions}</Text>
					</View>
					<View style={styles.row}>
						<Text style={styles.label}>Average Ticket Size</Text>
						<Text style={styles.value}>{formatCurrency(averageTicket)}</Text>
					</View>
				</View>

				{data.byCategory && data.byCategory.length > 0 && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>Revenue by Category</Text>
						{data.byCategory.map((cat: any, index: number) => (
							<View key={index} style={styles.row}>
								<Text style={styles.label}>{cat.category}</Text>
								<Text style={styles.value}>{formatCurrency(cat.total)}</Text>
							</View>
						))}
					</View>
				)}

                {data.expenses && data.expenses.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Expenses</Text>
                        {data.expenses.slice(0, 5).map((exp: any, index: number) => (
                            <View key={index} style={styles.row}>
                                <Text style={styles.label}>{exp.category} - {new Date(exp.expense_date).toLocaleDateString()}</Text>
                                <Text style={styles.value}>{formatCurrency(exp.amount)}</Text>
                            </View>
                        ))}
                         {data.expenses.length > 5 && (
                            <Text style={{ fontSize: 8, color: "#6B7280", marginTop: 4 }}>
                                ...and {data.expenses.length - 5} more expenses
                            </Text>
                        )}
                    </View>
                )}

				<View style={styles.footer}>
					<Text>Generated on {new Date().toLocaleString()} • Norpil Pool POS System</Text>
				</View>
			</Page>
		</Document>
	);
};
