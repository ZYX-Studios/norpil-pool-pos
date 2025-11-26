import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ReportData } from "../data";

// Professional Executive Report Styles
const styles = StyleSheet.create({
	page: {
		padding: 60,
		fontFamily: "Helvetica",
		fontSize: 10,
		color: "#1a1a1a",
		backgroundColor: "#FFFFFF",
	},

	// Header Section
	header: {
		marginBottom: 40,
		borderBottomWidth: 3,
		borderBottomColor: "#2563eb",
		paddingBottom: 20,
	},
	companyName: {
		fontSize: 28,
		fontFamily: "Helvetica-Bold",
		color: "#1e40af",
		marginBottom: 8,
		letterSpacing: 0.5,
	},
	reportTitle: {
		fontSize: 14,
		color: "#64748b",
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		letterSpacing: 1.5,
	},
	reportMeta: {
		marginTop: 15,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	metaItem: {
		fontSize: 9,
		color: "#475569",
	},
	metaLabel: {
		fontFamily: "Helvetica-Bold",
		marginRight: 5,
	},

	// Executive Summary
	executiveSummary: {
		marginBottom: 35,
		padding: 20,
		backgroundColor: "#f8fafc",
		borderRadius: 4,
		borderLeftWidth: 4,
		borderLeftColor: "#2563eb",
	},
	summaryTitle: {
		fontSize: 14,
		fontFamily: "Helvetica-Bold",
		color: "#1e40af",
		marginBottom: 15,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	summaryGrid: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 15,
	},
	summaryCard: {
		flex: 1,
		padding: 12,
		backgroundColor: "#ffffff",
		borderWidth: 1,
		borderColor: "#e2e8f0",
		borderRadius: 3,
	},
	summaryLabel: {
		fontSize: 8,
		color: "#64748b",
		fontFamily: "Helvetica-Bold",
		textTransform: "uppercase",
		marginBottom: 6,
		letterSpacing: 0.3,
	},
	summaryValue: {
		fontSize: 18,
		fontFamily: "Helvetica-Bold",
		color: "#0f172a",
		marginBottom: 4,
	},
	summarySubtext: {
		fontSize: 8,
		color: "#64748b",
	},
	positiveText: {
		color: "#059669",
		fontFamily: "Helvetica-Bold",
	},
	negativeText: {
		color: "#dc2626",
		fontFamily: "Helvetica-Bold",
	},

	// Section Styles
	section: {
		marginBottom: 30,
	},
	sectionTitle: {
		fontSize: 12,
		fontFamily: "Helvetica-Bold",
		color: "#1e40af",
		marginBottom: 12,
		textTransform: "uppercase",
		letterSpacing: 0.5,
		borderBottomWidth: 1,
		borderBottomColor: "#cbd5e1",
		paddingBottom: 6,
	},

	// Table Styles
	table: {
		width: "100%",
		borderWidth: 1,
		borderColor: "#e2e8f0",
	},
	tableHeader: {
		flexDirection: "row",
		backgroundColor: "#f1f5f9",
		borderBottomWidth: 1,
		borderBottomColor: "#cbd5e1",
		paddingVertical: 8,
		paddingHorizontal: 10,
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#f1f5f9",
		paddingVertical: 7,
		paddingHorizontal: 10,
	},
	tableRowAlt: {
		backgroundColor: "#f9fafb",
	},
	tableHeaderText: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: "#475569",
		textTransform: "uppercase",
	},
	tableCellText: {
		fontSize: 9,
		color: "#334155",
	},
	tableCellBold: {
		fontSize: 9,
		fontFamily: "Helvetica-Bold",
		color: "#1e293b",
	},

	// Column widths
	col1: { flex: 1 },
	col2: { flex: 1, textAlign: "right" },
	col3: { flex: 0.7, textAlign: "right" },
	colWide: { flex: 2 },

	// Two Column Layout
	twoColumnRow: {
		flexDirection: "row",
		gap: 20,
		marginBottom: 30,
	},
	column: {
		flex: 1,
	},

	// Footer
	footer: {
		position: "absolute",
		bottom: 40,
		left: 60,
		right: 60,
		borderTopWidth: 1,
		borderTopColor: "#e2e8f0",
		paddingTop: 12,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	footerText: {
		fontSize: 8,
		color: "#94a3b8",
	},
	footerBold: {
		fontFamily: "Helvetica-Bold",
	},
});

interface ExecutiveReportProps {
	data: ReportData;
	start: string;
	end: string;
}

// Format currency with PHP symbol
const formatPHP = (amount: number): string => {
	const formatted = amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return `₱${formatted}`;
};

const formatPercent = (value: number): string => {
	return `${value.toFixed(1)}%`;
};

const formatDate = (dateStr: string): string => {
	return new Date(dateStr).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
};

export const ExecutiveReport = ({ data, start, end }: ExecutiveReportProps) => {
	// Financial Calculations
	const totalRevenue = Number(data.total ?? 0);
	const txArray = data.tx ?? [];
	const totalTransactions = txArray.length;
	const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

	const expenseArray = data.expenses ?? [];
	const totalExpenses = expenseArray.reduce((sum, exp) => sum + Number(exp.amount ?? 0), 0);
	const netProfit = totalRevenue - totalExpenses;
	const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

	// Date formatting
	const reportPeriod = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
	const generatedOn = new Date().toLocaleString("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	});

	// Category Analysis
	const categories = (data.byCategory ?? [])
		.map((c: any) => ({
			name: c.category,
			revenue: Number(c.revenue ?? 0),
			percent: totalRevenue > 0 ? (Number(c.revenue ?? 0) / totalRevenue) * 100 : 0,
		}))
		.sort((a, b) => b.revenue - a.revenue);

	// Payment Methods
	const methodCounts = txArray.reduce((acc: Record<string, number>, curr: any) => {
		acc[curr.method] = (acc[curr.method] || 0) + 1;
		return acc;
	}, {});

	const methods = (data.byMethod ?? [])
		.map((m: any) => ({
			method: m.method,
			total: Number(m.revenue ?? 0),
			count: methodCounts[m.method] || 0,
		}))
		.sort((a, b) => b.total - a.total);

	// Top Expenses
	const topExpenses = expenseArray
		.sort((a, b) => Number(b.amount) - Number(a.amount))
		.slice(0, 10);

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Header */}
				<View style={styles.header}>
					<Text style={styles.companyName}>NORPIL BILLIARDS</Text>
					<Text style={styles.reportTitle}>Executive Financial Report</Text>
					<View style={styles.reportMeta}>
						<View>
							<Text style={styles.metaItem}>
								<Text style={styles.metaLabel}>Reporting Period:</Text>
								{reportPeriod}
							</Text>
						</View>
						<View>
							<Text style={styles.metaItem}>
								<Text style={styles.metaLabel}>Generated:</Text>
								{generatedOn}
							</Text>
						</View>
					</View>
				</View>

				{/* Executive Summary */}
				<View style={styles.executiveSummary}>
					<Text style={styles.summaryTitle}>Financial Overview</Text>
					<View style={styles.summaryGrid}>
						<View style={styles.summaryCard}>
							<Text style={styles.summaryLabel}>Total Revenue</Text>
							<Text style={styles.summaryValue}>{formatPHP(totalRevenue)}</Text>
							<Text style={styles.summarySubtext}>{totalTransactions} transactions</Text>
						</View>
						<View style={styles.summaryCard}>
							<Text style={styles.summaryLabel}>Net Profit</Text>
							<Text style={[styles.summaryValue, netProfit >= 0 ? styles.positiveText : styles.negativeText]}>
								{formatPHP(netProfit)}
							</Text>
							<Text style={[styles.summarySubtext, netProfit >= 0 ? styles.positiveText : styles.negativeText]}>
								{formatPercent(netMargin)} margin
							</Text>
						</View>
						<View style={styles.summaryCard}>
							<Text style={styles.summaryLabel}>Total Expenses</Text>
							<Text style={[styles.summaryValue, styles.negativeText]}>{formatPHP(totalExpenses)}</Text>
							<Text style={styles.summarySubtext}>{expenseArray.length} expense records</Text>
						</View>
						<View style={styles.summaryCard}>
							<Text style={styles.summaryLabel}>Average Ticket</Text>
							<Text style={styles.summaryValue}>{formatPHP(averageTicket)}</Text>
							<Text style={styles.summarySubtext}>per transaction</Text>
						</View>
					</View>
				</View>

				{/* Revenue by Category */}
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Revenue by Category</Text>
					<View style={styles.table}>
						<View style={styles.tableHeader}>
							<Text style={[styles.tableHeaderText, styles.colWide]}>Category</Text>
							<Text style={[styles.tableHeaderText, styles.col2]}>Revenue</Text>
							<Text style={[styles.tableHeaderText, styles.col3]}>% of Total</Text>
						</View>
						{categories.map((cat, index) => (
							<View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
								<Text style={[styles.tableCellBold, styles.colWide]}>{cat.name}</Text>
								<Text style={[styles.tableCellText, styles.col2]}>{formatPHP(cat.revenue)}</Text>
								<Text style={[styles.tableCellText, styles.col3]}>{formatPercent(cat.percent)}</Text>
							</View>
						))}
					</View>
				</View>

				{/* Two Column Section: Payment Methods & Top Expenses */}
				<View style={styles.twoColumnRow}>
					{/* Payment Methods */}
					<View style={styles.column}>
						<Text style={styles.sectionTitle}>Payment Methods</Text>
						<View style={styles.table}>
							<View style={styles.tableHeader}>
								<Text style={[styles.tableHeaderText, styles.col1]}>Method</Text>
								<Text style={[styles.tableHeaderText, styles.col2]}>Count</Text>
								<Text style={[styles.tableHeaderText, styles.col2]}>Total</Text>
							</View>
							{methods.map((method, index) => (
								<View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
									<Text style={[styles.tableCellBold, styles.col1]}>{method.method}</Text>
									<Text style={[styles.tableCellText, styles.col2]}>{method.count}</Text>
									<Text style={[styles.tableCellText, styles.col2]}>{formatPHP(method.total)}</Text>
								</View>
							))}
						</View>
					</View>

					{/* Top Expenses */}
					<View style={styles.column}>
						<Text style={styles.sectionTitle}>Major Expenses</Text>
						<View style={styles.table}>
							<View style={styles.tableHeader}>
								<Text style={[styles.tableHeaderText, styles.colWide]}>Description</Text>
								<Text style={[styles.tableHeaderText, styles.col2]}>Amount</Text>
							</View>
							{topExpenses.slice(0, 6).map((exp: any, index: number) => (
								<View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
									<Text style={[styles.tableCellText, styles.colWide]}>
										{exp.category}
										{exp.note ? ` (${exp.note})` : ""}
									</Text>
									<Text style={[styles.tableCellBold, styles.col2]}>{formatPHP(exp.amount)}</Text>
								</View>
							))}
						</View>
						{expenseArray.length > 6 && (
							<Text style={{ fontSize: 8, color: "#64748b", marginTop: 6, textAlign: "right", fontStyle: "italic" }}>
								+ {expenseArray.length - 6} additional expense records
							</Text>
						)}
					</View>
				</View>

				{/* Footer */}
				<View style={styles.footer}>
					<Text style={styles.footerText}>
						<Text style={styles.footerBold}>CONFIDENTIAL</Text> - For Internal Use Only
					</Text>
					<Text style={styles.footerText}>Norpil Billiards POS System</Text>
					<Text style={styles.footerText}>Page 1 of 1</Text>
				</View>
			</Page>
		</Document>
	);
};
