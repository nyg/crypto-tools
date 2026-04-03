import { NextResponse } from 'next/server'

export default function middleware(request) {
   return request.headers.get('authorization') === `Bearer ${process.env.CRON_KEY}`
      ? NextResponse.next()
      : NextResponse.json({ error: 'Authentication required!' }, { status: 401 })
}

export const config = {
   matcher: '/api/swissborg/cron/:path*'
}
