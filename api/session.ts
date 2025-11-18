import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const cookies = req.headers.cookie || '';
    const tenantCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('phraseotomy_tenant='));
    const shopCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('phraseotomy_shop='));

    if (!tenantCookie || !shopCookie) {
      console.log('No session cookies found');
      return res.status(401).json({ 
        error: 'No active session. Please access via Shopify App Proxy.',
        hasSession: false 
      });
    }

    const tenantValue = decodeURIComponent(tenantCookie.split('=')[1]);
    const shopValue = decodeURIComponent(shopCookie.split('=')[1]);
    const tenant = JSON.parse(tenantValue);

    console.log('Session data retrieved:', { tenant: tenant.tenant_key, shop: shopValue });

    return res.status(200).json({
      hasSession: true,
      tenant,
      shop: shopValue,
    });

  } catch (error) {
    console.error('Error reading session:', error);
    return res.status(500).json({ 
      error: 'Failed to read session',
      hasSession: false 
    });
  }
}
