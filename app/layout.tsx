import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Norpil Billiards POS",
	description: "Point of sale system for Norpil Billiards pool hall.",
	// Point the browser to our PWA manifest so it understands the app capabilities.
	manifest: "/manifest.json",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				{/* 
					Register the service worker once on the client. 
					This keeps offline behavior consistent across all routes.
				*/}
				<ServiceWorkerRegistrar />
				{children}
			</body>
		</html>
	);
}

