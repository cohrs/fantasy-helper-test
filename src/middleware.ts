import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only enforce HTTPS in development (production handles this at platform level)
  if (process.env.NODE_ENV === 'development') {
    const url = request.nextUrl;
    
    // Check if request is HTTP (not HTTPS)
    if (url.protocol === 'http:') {
      const httpsUrl = url.clone();
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
