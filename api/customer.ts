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
    const customerCookie = cookies
      .split(';')
      .find(c => c.trim().startsWith('phraseotomy_customer='));

    if (!customerCookie) {
      console.log('No customer cookie found');
      return res.status(200).json({ 
        isLoggedIn: false,
        customer: null
      });
    }

    const customerValue = decodeURIComponent(customerCookie.split('=')[1]);
    const customer = JSON.parse(customerValue);

    console.log('Customer data retrieved:', { customerId: customer.id });

    return res.status(200).json({
      isLoggedIn: true,
      customer,
    });

  } catch (error) {
    console.error('Error reading customer data:', error);
    return res.status(500).json({ 
      error: 'Failed to read customer data',
      isLoggedIn: false,
      customer: null
    });
  }
}
