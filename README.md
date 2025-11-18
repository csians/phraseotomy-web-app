# Phraseotomy Web App

A mobile-first web application for the Phraseotomy board game, designed to be embedded in Shopify stores.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL database, authentication, storage)
- **UI Components**: shadcn/ui

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Route pages
│   ├── Play.tsx   # Main game screen
│   └── NotFound.tsx
├── lib/           # Core utilities and integrations
│   ├── supabaseClient.ts  # Supabase client setup
│   ├── tenants.ts         # Multi-tenant configuration
│   └── utils.ts
└── App.tsx        # Main app with routing
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd phraseotomy-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Then fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_APP_ENV=development
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:8080`

### Testing Multi-Tenant Features

The app supports multiple Shopify stores via tenant detection:

- **Staging**: `http://localhost:8080/play?shop=testing-cs-store.myshopify.com`
- **Production**: `http://localhost:8080/play?shop=phraseotomy.myshopify.com`

## Multi-Tenant System

The app uses a tenant configuration system to support multiple Shopify stores:

### How It Works

1. **Shop Parameter**: The app reads the `shop` query parameter from the URL (e.g., `?shop=testing-cs-store.myshopify.com`)

2. **Tenant Detection**: `src/lib/tenants.ts` contains the `getTenantConfig()` function that maps shop domains to tenant configurations

3. **Current Tenants**:
   - `testing-cs-store.myshopify.com` → Staging environment
   - `phraseotomy.myshopify.com` → Production environment

### Adding New Tenants

Edit `src/lib/tenants.ts` and add a new entry to the `tenants` array:

```typescript
{
  id: 'new-tenant',
  shopDomain: 'your-store.myshopify.com',
  displayName: 'Your Store Name',
  themeColor: '#FCD34D',
}
```

## Supabase Integration

### Client Setup

The Supabase client is configured in `src/lib/supabaseClient.ts` and reads from environment variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

### Example Functions

Two example functions are included:

- `testConnection()`: Tests the database connection
- `createGameSession()`: Creates a new game session record

### Database Schema (Placeholder)

The code references a `game_sessions` table. You'll need to create this in Supabase:

```sql
create table game_sessions (
  id uuid default uuid_generate_v4() primary key,
  shop_domain text not null,
  tenant_id text not null,
  players integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

## Shopify Embedding (Future)

This app is designed to be embedded in Shopify stores via an App Proxy. When deployed:

1. The Shopify store sends traffic to your deployed app with shop info in the URL
2. The app detects the shop domain and loads the appropriate tenant configuration
3. Users interact with the game within their Shopify storefront

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

### Environment Variables

All environment variables must be prefixed with `VITE_` to be accessible in the browser:

- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_APP_ENV`
- ❌ `SUPABASE_URL` (won't work)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The app can be deployed to any static hosting platform that supports Vite:
- Netlify
- Cloudflare Pages
- AWS S3 + CloudFront

## Design System

The app uses a custom Phraseotomy theme:

- **Background**: Black (`#000000`)
- **Primary/Accent**: Yellow (`#FCD34D`)
- **Typography**: Bold, game-focused
- **Layout**: Mobile-first, full-screen

All design tokens are defined in:
- `src/index.css` (CSS variables)
- `tailwind.config.ts` (Tailwind theme)

## Contributing

This is a development build. The skeleton is in place for:

- Multi-tenant Shopify support ✅
- Supabase backend integration ✅
- Mobile-first UI ✅
- Routing infrastructure ✅

Next steps:
- Implement game logic
- Add player management
- Build score tracking
- Create admin dashboard

## License

[Your License Here]

## Support

For issues or questions, contact [your-contact-info]
