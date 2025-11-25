"use client";

import React from "react";

export function PrintPageLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="print-layout bg-white text-neutral-900 min-h-screen">
			<style jsx global>{`
				@page {
					size: A4 portrait;
					margin: 0;
				}
				@media print {
					body {
						-webkit-print-color-adjust: exact;
						print-color-adjust: exact;
						background-color: white;
					}
					/* Hide any UI elements that might accidentally leak in */
					header, nav, footer, .no-print {
						display: none !important;
					}
				}
				.print-page {
					width: 210mm;
					height: 297mm;
					padding: 15mm;
					margin: 0 auto;
					background: white;
					position: relative;
					overflow: hidden;
					page-break-after: always;
					display: flex;
					flex-direction: column;
				}
				/* For screen preview */
				@media screen {
					.print-layout {
						background-color: #525252;
						padding: 20px;
						display: flex;
						flex-direction: column;
						align-items: center;
						gap: 20px;
					}
					.print-page {
						box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
					}
				}
			`}</style>
			{children}
		</div>
	);
}
