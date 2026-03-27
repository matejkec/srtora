import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@srtora/types', '@srtora/core', '@srtora/adapters', '@srtora/prompts', '@srtora/pipeline'],
}

export default nextConfig
