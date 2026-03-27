/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['rss-parser', 'iconv-lite'],
  },
}

export default nextConfig
