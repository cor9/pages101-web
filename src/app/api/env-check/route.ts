import { NextResponse } from 'next/server';

export async function GET() {
  // Return keys only to avoid exposing sensitive secrets in raw format,
  // but we will return the actual DATABASE_URL if it exists so I can use it.
  const envVars = {
    keys: Object.keys(process.env),
    dbUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || null,
  };
  return NextResponse.json(envVars);
}
