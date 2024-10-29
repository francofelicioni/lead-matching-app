import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import envs from '@/config/envConfig.js';

export async function POST(req) {
  const { password } = await req.json();

  if (password === envs.APP_PASSWORD) {
    // Generate an auth token
    const authToken = 'authenticated';

    // Set a secure, HttpOnly cookie to remember the user session
    cookies().set('auth-token', authToken, {
      httpOnly: true,
      secure: envs.NODE_ENV === 'production',
      path: '/', // Ensure the cookie is accessible site-wide
      maxAge: 60 * 60 * 24, // 1 day
    });

    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  }
}
