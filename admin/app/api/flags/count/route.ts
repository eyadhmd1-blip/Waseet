import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyToken } from '../../../lib/token';

const COOKIE_NAME = 'waseet_admin_session';

export async function GET() {
  const jar    = await cookies();
  const token  = jar.get(COOKIE_NAME)?.value;
  const result = token ? await verifyToken(token) : { valid: false };
  if (!result.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc('get_unreviewed_flags_count');
  if (error) {
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: data ?? 0 });
}
