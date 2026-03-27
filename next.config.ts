import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['rss-parser', 'iconv-lite'],
  },
}

export default nextConfig
