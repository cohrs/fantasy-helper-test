import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only enforce HTTPS in development (production handles this at platform level)
  if (process.env.NODE_ENV === 'development') {
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    
    if (protocol === 'http') {
      const url = request.nextUrl.clone();
      url.protocol = 'https:';
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
