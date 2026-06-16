import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]
  
  // Skip for the main app domain, localhost, and Vercel previews
  if (
    host === 'pages.childactor101.com' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host?.endsWith('.vercel.app')
  ) {
    return NextResponse.next()
  }

  // Custom domain — look up slug
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  const { data } = await supabase
    .from('p101_custom_domains')
    .select('page_id, p101_actor_pages(slug)')
    .eq('domain', host)
    .eq('verified', true)
    .single()

  const slug = (data as any)?.p101_actor_pages?.slug

  if (slug) {
    return NextResponse.rewrite(
      new URL(`/p/${slug}`, request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
}
