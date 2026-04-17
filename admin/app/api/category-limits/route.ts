import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyToken } from '../../login/actions';

const COOKIE_NAME = 'waseet_admin_session';

export async function POST(req: NextRequest) {
  // Require admin session
  const jar    = await cookies();
  const token  = jar.get(COOKIE_NAME)?.value;
  const result = token ? await verifyToken(token) : { valid: false };
  if (!result.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, min_bid, max_bid } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('service_categories')
    .update({ min_bid: min_bid ?? null, max_bid: max_bid ?? null })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
