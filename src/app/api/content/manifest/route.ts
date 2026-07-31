import { NextResponse } from 'next/server';
import manifestData from '@/content/manifest.json';

export async function GET() {
  return NextResponse.json({ ok: true, manifest: manifestData });
}
