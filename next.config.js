/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'your-supabase-project.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  experimental: {
    // For app directory API routes
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },

  // Global API routes configuration
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
    responseLimit: false,
  },

}

module.exports = nextConfig 