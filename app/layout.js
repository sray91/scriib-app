import { Bebas_Neue, Lexend_Deca } from 'next/font/google'
import { headers, cookies } from 'next/headers'
import './globals.css'
import MainLayout from '@/components/MainLayout'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
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
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { session } } = await supabase.auth.getSession()

  const headersList = await headers()
  const pathname = headersList.get('x-invoke-path') || ''

  const isSharedRoute = pathname.startsWith('/shared/')
  const authPaths = ['/login', '/signup', '/approver-signup', '/invite-complete']
  const isAuthPath = authPaths.some(route => pathname.startsWith(route))
  const excludeMainLayout = ['/settings', '/approval-portal']
  const shouldExcludeMainLayout = excludeMainLayout.some(route => pathname.startsWith(route)) || isSharedRoute

  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href={bebasNeue.url}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={lexendDeca.url}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${bebasNeue.variable} ${lexendDeca.variable} ${lexendDeca.className} overscroll-x-auto`}>
        <Providers>
          {isAuthPath ? (
            children
          ) : session && !shouldExcludeMainLayout ? (
            <MainLayout>{children}</MainLayout>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  )
}