import { NextRequest, NextResponse } from 'next/server';

const VALID_USERNAME = 'yakuza';
const VALID_PASSWORD = 'yakuza@2982';
const AUTH_COOKIE    = 'yakuza_auth';
const AUTH_TOKEN     = 'yakuza_session_v1';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username?: string; password?: string };

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE, AUTH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return response;
  }

  return NextResponse.json(
    { success: false, message: 'Invalid username or password' },
    { status: 401 },
  );
}
