import { Bebas_Neue, Lexend_Deca } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import MainLayout from '@/components/MainLayout'
import { ClerkProvider } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import Providers from '@/components/Providers'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
})

const lexendDeca = Lexend_Deca({
  subsets: ['latin'],
  variable: '--font-lexend-deca',
})

export default async function RootLayout({ children }) {
  const { userId } = await auth()
  const isAuthenticated = !!userId

  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || ''

  const isSharedRoute = pathname.startsWith('/shared/')
  const authPaths = ['/login', '/signup', '/approver-signup', '/invite-complete', '/reset-password']
  const isAuthPath = authPaths.some(route => pathname.startsWith(route))
  const excludeMainLayout = ['/settings', '/approval-portal']
  const shouldExcludeMainLayout = excludeMainLayout.some(route => pathname.startsWith(route)) || isSharedRoute

  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* Primary Meta Tags */}
          <title>Scriib - AI-Powered Content Creation Platform</title>
          <meta name="title" content="Scriib - AI-Powered Content Creation Platform" />
          <meta name="description" content="Create, edit, and schedule engaging social media content with AI assistance. Streamline your content workflow with approval workflows and team collaboration." />
          <meta name="keywords" content="content creation, social media, AI, automation, scheduling, approval workflow" />
          <meta name="author" content="Scriib" />
          <meta name="robots" content="index, follow" />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://app.scriib.ai/" />
          <meta property="og:title" content="Scriib - AI-Powered Content Creation Platform" />
          <meta property="og:description" content="Create, edit, and schedule engaging social media content with AI assistance. Streamline your content workflow with approval workflows and team collaboration." />
          <meta property="og:image" content="https://app.scriib.ai/scriib-logo.png" />

          {/* Twitter */}
          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:url" content="https://app.scriib.ai/" />
          <meta property="twitter:title" content="Scriib - AI-Powered Content Creation Platform" />
          <meta property="twitter:description" content="Create, edit, and schedule engaging social media content with AI assistance. Streamline your content workflow with approval workflows and team collaboration." />
          <meta property="twitter:image" content="https://app.scriib.ai/scriib-logo.png" />

          {/* Favicon */}
          <link rel="icon" type="image/png" sizes="32x32" href="/scriib-logo.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/scriib-logo.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/scriib-logo.png" />
          <link rel="manifest" href="/site.webmanifest" />

          {/* Viewport */}
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />

          {/* Theme Color */}
          <meta name="theme-color" content="#fb2e01" />

        </head>
        <body className={`${bebasNeue.variable} ${lexendDeca.variable} ${lexendDeca.className} overscroll-x-auto`}>
          <Providers>
            {isAuthPath ? (
              children
            ) : isAuthenticated && !shouldExcludeMainLayout ? (
              <MainLayout>{children}</MainLayout>
            ) : (
              children
            )}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}