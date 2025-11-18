import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

async function verifyShopifyHmac(
  queryParams: URLSearchParams,
  clientSecret: string
): Promise<boolean> {
  // Shopify App Proxy sends signature as 'signature'
  const signature = queryParams.get('signature');
  if (!signature) {
    console.log('No signature parameter found');
    return false;
  }

  // Build the message exactly as in Shopify docs:
  // 1) Remove signature
  // 2) For each key, join multiple values with commas
  // 3) Sort by key
  // 4) Concatenate as key=value with NO separator between pairs
  const paramMap = new Map<string, string[]>();
  for (const [key, value] of queryParams.entries()) {
    if (key === 'signature') continue;
    const existing = paramMap.get(key) ?? [];
    existing.push(value);
    paramMap.set(key, existing);
  }

  const sortedPairs = Array.from(paramMap.entries())
    .map(([key, values]) => `${key}=${values.join(',')}`)
    .sort();

  const message = sortedPairs.join('');

  const generatedHash = createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex');

  const isValid = generatedHash === signature;
  console.log('HMAC verification:', { isValid, generatedHash, providedSignature: signature, message });
  
  return isValid;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url || '', `https://${req.headers.host}`);
    const queryParams = url.searchParams;
    const shop = queryParams.get('shop');

    console.log('Proxy request received:', { shop, params: Array.from(queryParams.entries()) });

    if (!shop) {
      console.error('No shop parameter detected');
      return res.status(400).json({ error: 'No shop parameter detected' });
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch tenant configuration
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('shop_domain', shop)
      .eq('is_active', true)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Tenant lookup failed:', tenantError);
      return res.status(404).json({ error: 'Unknown tenant for this shop domain' });
    }

    console.log('Tenant found:', tenant.tenant_key);

    // Verify HMAC signature
    const isValidHmac = await verifyShopifyHmac(queryParams, tenant.shopify_client_secret);
    
    if (!isValidHmac) {
      console.error('HMAC verification failed');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log('HMAC verified successfully');

    // Prepare tenant data for cookie (sanitize sensitive fields)
    const tenantData = {
      id: tenant.id,
      name: tenant.name,
      tenant_key: tenant.tenant_key,
      shop_domain: tenant.shop_domain,
      environment: tenant.environment,
      verified: true,
    };

    // Set secure HTTP-only cookie with tenant data
    const cookieValue = JSON.stringify(tenantData);
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.setHeader('Set-Cookie', [
      `phraseotomy_tenant=${encodeURIComponent(cookieValue)}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${isProduction ? '; Secure' : ''}`,
      `phraseotomy_shop=${shop}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${isProduction ? '; Secure' : ''}`
    ]);

    console.log('Cookie set, redirecting to /play');

    // Redirect to /play page
    res.setHeader('Location', '/play');
    return res.status(302).end();

  } catch (error) {
    console.error('Error in proxy handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
