import { NextResponse } from 'next/server';

export function middleware(req) {
  const token = req.cookies.get('auth-token')?.value;

  // If token is missing, redirect to the login page
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Set the protected routes
export const config = {
  matcher: ['/'], 
};
