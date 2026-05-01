import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  void req;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
