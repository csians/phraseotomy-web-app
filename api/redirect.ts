import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { to } = req.query;

  if (!to || typeof to !== 'string') {
    return res.status(400).send('Missing or invalid "to" parameter');
  }

  // Validate the URL is a Shopify domain for security
  try {
    const url = new URL(to);
    if (!url.hostname.endsWith('.myshopify.com') && !url.hostname.endsWith('shopify.com')) {
      return res.status(400).send('Invalid redirect URL');
    }
  } catch (err) {
    return res.status(400).send('Invalid URL format');
  }

  // Return a page that redirects the top-level window
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Redirecting...</title>
      </head>
      <body>
        <p>Redirecting to login...</p>
        <script>
          window.top.location.href = ${JSON.stringify(to)};
        </script>
      </body>
    </html>
  `);
}
