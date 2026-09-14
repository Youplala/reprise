/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // The screenshot editor is a standalone Next.js app nested in an Expo repo.
  // Ignore the parent Expo ESLint config during `next build`; TypeScript is
  // checked separately in this package.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
