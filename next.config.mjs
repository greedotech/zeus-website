/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Excel reader (read-excel-file -> unzipper) has optional deps webpack can't bundle; load it from node_modules at runtime.
    serverComponentsExternalPackages: ["read-excel-file", "unzipper"],
  },
};

export default nextConfig;
