import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Pin Turbopack root to this project to avoid picking parent directories
	turbopack: {
		root: __dirname,
	},
	serverExternalPackages: ["puppeteer"],
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'wafmycddsldscayemwpp.supabase.co',
				pathname: '/storage/v1/object/public/**',
			},
		],
	},
};

export default nextConfig;
