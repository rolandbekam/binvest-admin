import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return NextResponse.json({ admin: null }, { status: 401 });

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'binvest-admin',
      audience: 'binvest-admin-panel',
    });
    return NextResponse.json({
      admin: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      }
    });
  } catch {
    return NextResponse.json({ admin: null }, { status: 401 });
  }
}
