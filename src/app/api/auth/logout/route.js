import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  const response = NextResponse.json({ success: true });

  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
