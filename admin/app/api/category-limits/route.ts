import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../lib/supabase';
import { verifyToken } from '../../lib/token';

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

  // Validate numeric inputs (BUG-027)
  if (min_bid !== null && min_bid !== undefined) {
    const n = Number(min_bid);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'min_bid must be a non-negative number' }, { status: 400 });
    }
  }
  if (max_bid !== null && max_bid !== undefined) {
    const n = Number(max_bid);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'max_bid must be a non-negative number' }, { status: 400 });
    }
  }
  if (min_bid != null && max_bid != null && Number(min_bid) >= Number(max_bid)) {
    return NextResponse.json({ error: 'min_bid must be less than max_bid' }, { status: 400 });
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
