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

  const excludeMainLayout = ['/login', '/signup', '/settings']
  const shouldExcludeMainLayout = excludeMainLayout.some(route => pathname.startsWith(route))

  return (
    <html lang="en">
      <body className={`${bebasNeue.variable} ${lexendDeca.variable} ${lexendDeca.className} overscroll-x-auto`}>
        <Providers>
          {session && !shouldExcludeMainLayout ? (
            <MainLayout>{children}</MainLayout>
          ) : (
            children
          )}
        </Providers>
      </body>
    </html>
  )
}