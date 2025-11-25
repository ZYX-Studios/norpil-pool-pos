import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Pin Turbopack root to this project to avoid picking parent directories
	turbopack: {
		root: __dirname,
	},
	serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
