# Tenant Frontend Setup Guide

## Overview

The Tenant Frontend is a Next.js/React Single Page Application (SPA) that serves as the customer-facing interface for each tenant in the BlocoManager multi-tenant system. Each tenant receives their own containerized instance of this frontend, allowing for complete isolation and customization.

**Key Features:**
- Dynamic tenant configuration fetched from BlocoManager API
- Tenant-specific branding and theming
- Product catalog and booking system
- Responsive design with TailwindCSS
- Optimized Docker deployment
- Environment-based tenant identification

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with SSR/SSG capabilities |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first CSS framework |
| Axios | 1.x | HTTP client for API calls |
| date-fns | 2.x | Date manipulation |

---

## Project Structure

```
tenant-frontend/
├── public/
│   ├── favicon.ico
│   └── images/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── products/
│   │   │   └── page.tsx
│   │   ├── booking/
│   │   │   └── page.tsx
│   │   └── about/
│   │       └── page.tsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   ├── Product/
│   │   │   ├── ProductCard.tsx
│   │   │   └── ProductList.tsx
│   │   └── Common/
│   │       ├── Button.tsx
│   │       └── Loading.tsx
│   ├── context/
│   │   └── TenantContext.tsx
│   ├── services/
│   │   ├── api.ts
│   │   ├── tenantService.ts
│   │   └── productService.ts
│   ├── types/
│   │   ├── tenant.ts
│   │   └── product.ts
│   └── utils/
│       └── theme.ts
├── .env.example
├── next.config.js
├── tailwind.config.js
├── package.json
└── Dockerfile
```

---

## Setup Steps

### 1. Create Next.js Application

```bash
npx create-next-app@14 tenant-frontend --typescript --tailwind --app
cd tenant-frontend
```

### 2. Install Dependencies

```bash
npm install axios date-fns
```

### 3. Update package.json

```json
{
  "name": "tenant-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "18.3.0",
    "react-dom": "18.3.0",
    "axios": "^1.6.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "tailwindcss": "^3.4.0",
    "typescript": "^5"
  }
}
```

---

## Implementation

### 1. API Service Configuration

**src/services/api.ts**

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3002';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);
```

### 2. Tenant Types

**src/types/tenant.ts**

```typescript
export interface TenantConfig {
  tenantId: string;
  name: string;
  domain: string;
  description?: string;
  settings?: {
    emailSettings?: {
      fromName?: string;
      fromEmail?: string;
    };
    branding?: {
      primaryColor?: string;
      logoUrl?: string;
      favicon?: string;
    };
    features?: {
      enableNotifications?: boolean;
      enableCalendarIntegration?: boolean;
      enablePayments?: boolean;
    };
  };
  frontendUrl?: string;
  deploymentStatus?: string;
}
```

**src/types/product.ts**

```typescript
export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration?: number; // in minutes
  tenant?: string;
  active: boolean;
  createdAt: string;
}
```

### 3. Tenant Service

**src/services/tenantService.ts**

```typescript
import { apiClient } from './api';
import { TenantConfig } from '@/types/tenant';

export const tenantService = {
  getTenantConfig: async (tenantId: string): Promise<TenantConfig> => {
    const response = await apiClient.get(`/api/tenant-public/${tenantId}`);
    return response.data;
  },

  getTenantBySubdomain: async (subdomain: string): Promise<TenantConfig> => {
    const response = await apiClient.get(`/api/tenant-public/subdomain/${subdomain}`);
    return response.data;
  },
};
```

### 4. Product Service

**src/services/productService.ts**

```typescript
import { apiClient } from './api';
import { Product } from '@/types/product';

export const productService = {
  getProducts: async (tenantId: string): Promise<Product[]> => {
    const response = await apiClient.get(`/api/tenant-public/${tenantId}/products`);
    return response.data;
  },

  getProduct: async (tenantId: string, productId: string): Promise<Product> => {
    const response = await apiClient.get(`/api/tenant-public/${tenantId}/products/${productId}`);
    return response.data;
  },
};
```

### 5. Tenant Context

**src/context/TenantContext.tsx**

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { TenantConfig } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';

interface TenantContextType {
  tenant: TenantConfig | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  loading: true,
  error: null,
});

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenantConfig = async () => {
      try {
        const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
        
        if (!tenantId) {
          throw new Error('NEXT_PUBLIC_TENANT_ID is not configured');
        }

        const config = await tenantService.getTenantConfig(tenantId);
        setTenant(config);
        
        // Apply branding
        applyBranding(config);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant configuration');
        console.error('Tenant config error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantConfig();
  }, []);

  const applyBranding = (config: TenantConfig) => {
    const primaryColor = config.settings?.branding?.primaryColor || '#3b82f6';
    const logoUrl = config.settings?.branding?.logoUrl;
    const favicon = config.settings?.branding?.favicon;
    
    // Set CSS variables for theming
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    
    // Set page title
    document.title = config.name;
    
    // Set favicon
    if (favicon) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = favicon;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  };

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
};
```

### 6. Root Layout

**src/app/layout.tsx**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { TenantProvider } from '@/context/TenantContext';
import Header from '@/components/Layout/Header';
import Footer from '@/components/Layout/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Loading...',
  description: 'Tenant application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TenantProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
        </TenantProvider>
      </body>
    </html>
  );
}
```

### 7. Home Page

**src/app/page.tsx**

```typescript
'use client';

import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';

export default function Home() {
  const { tenant, loading, error } = useTenant();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p>{error || 'Failed to load tenant configuration'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        {tenant.settings?.branding?.logoUrl && (
          <img
            src={tenant.settings.branding.logoUrl}
            alt={tenant.name}
            className="h-24 mx-auto mb-6"
          />
        )}
        <h1 className="text-5xl font-bold mb-4" style={{ color: tenant.settings?.branding?.primaryColor || '#3b82f6' }}>
          Welcome to {tenant.name}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {tenant.description || 'Your trusted partner for professional services'}
        </p>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-8 mb-16">
        <Link href="/products" className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-semibold mb-3" style={{ color: tenant.settings?.branding?.primaryColor || '#3b82f6' }}>
            Our Services
          </h3>
          <p className="text-gray-600">
            Explore our range of professional services tailored to your needs.
          </p>
        </Link>
        
        <Link href="/booking" className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-semibold mb-3" style={{ color: tenant.settings?.branding?.primaryColor || '#3b82f6' }}>
            Book Appointment
          </h3>
          <p className="text-gray-600">
            Schedule a consultation at a time that works for you.
          </p>
        </Link>
        
        <Link href="/about" className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-semibold mb-3" style={{ color: tenant.settings?.branding?.primaryColor || '#3b82f6' }}>
            About Us
          </h3>
          <p className="text-gray-600">
            Learn more about our mission and values.
          </p>
        </Link>
      </section>
    </div>
  );
}
```

### 8. Products Page

**src/app/products/page.tsx**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import Link from 'next/link';

export default function ProductsPage() {
  const { tenant, loading: tenantLoading } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      loadProducts();
    }
  }, [tenant]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts(tenant!.tenantId);
      setProducts(data);
    } catch (err) {
      setError('Failed to load products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (tenantLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8 text-center">Our Services</h1>
      
      {products.length === 0 ? (
        <p className="text-center text-gray-600">No services available at the moment.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product._id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
                <p className="text-gray-600 mb-4">{product.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold" style={{ color: tenant?.settings?.branding?.primaryColor || '#3b82f6' }}>
                    ${product.price} {product.currency}
                  </span>
                  {product.duration && (
                    <span className="text-sm text-gray-500">{product.duration} min</span>
                  )}
                </div>
                <Link
                  href={`/booking?productId=${product._id}`}
                  className="mt-4 block w-full text-center py-2 px-4 rounded text-white transition-colors"
                  style={{ backgroundColor: tenant?.settings?.branding?.primaryColor || '#3b82f6' }}
                >
                  Book Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 9. Header Component

**src/components/Layout/Header.tsx**

```typescript
'use client';

import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';

export default function Header() {
  const { tenant } = useTenant();

  if (!tenant) return null;

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            {tenant.settings?.branding?.logoUrl && (
              <img src={tenant.settings.branding.logoUrl} alt={tenant.name} className="h-10" />
            )}
            <span className="text-xl font-bold" style={{ color: tenant.settings?.branding?.primaryColor || '#3b82f6' }}>
              {tenant.name}
            </span>
          </Link>
          
          <ul className="flex space-x-6">
            <li>
              <Link href="/" className="hover:text-primary transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-primary transition-colors">
                Services
              </Link>
            </li>
            <li>
              <Link href="/booking" className="hover:text-primary transition-colors">
                Book
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-primary transition-colors">
                About
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
```

### 10. Footer Component

**src/components/Layout/Footer.tsx**

```typescript
'use client';

import { useTenant } from '@/context/TenantContext';

export default function Footer() {
  const { tenant } = useTenant();

  if (!tenant) return null;

  return (
    <footer className="bg-gray-800 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-3">{tenant.name}</h3>
            <p className="text-gray-400 text-sm">
              {tenant.description || 'Your trusted partner for professional services.'}
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3">Contact</h3>
            <div className="text-gray-400 text-sm space-y-1">
              {tenant.settings?.emailSettings?.fromEmail && (
                <p>{tenant.settings.emailSettings.fromEmail}</p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-3">Quick Links</h3>
            <ul className="text-gray-400 text-sm space-y-1">
              <li><a href="/" className="hover:text-white">Home</a></li>
              <li><a href="/products" className="hover:text-white">Services</a></li>
              <li><a href="/about" className="hover:text-white">About</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
```

### 11. Global Styles

**src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #3b82f6;
}

body {
  @apply bg-gray-50;
}

.btn-primary {
  @apply bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90 transition-opacity;
}
```

### 12. Tailwind Configuration

**tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
      },
    },
  },
  plugins: [],
};
```

---

## Environment Variables

### .env.example

```env
# Tenant Configuration
NEXT_PUBLIC_TENANT_ID=tenant-uuid-here

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://api.blocomanager.com
```

---

## Dockerfile

**Dockerfile**

```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_TENANT_ID: process.env.NEXT_PUBLIC_TENANT_ID,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
};

module.exports = nextConfig;
```

---

## Building Docker Image

```bash
# Build the image
docker build -t tenant-frontend:latest .

# Test locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_TENANT_ID=test-tenant \
  -e NEXT_PUBLIC_API_BASE_URL=http://localhost:3002 \
  tenant-frontend:latest
```

---

## Testing

1. **Install dependencies**: `npm install`
2. **Set environment variables**:
   ```bash
   export NEXT_PUBLIC_TENANT_ID=test-tenant-123
   export NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
   ```
3. **Run development server**: `npm run dev`
4. **Visit**: http://localhost:3000

---

**Documentation Version:** 1.0  
**Last Updated:** January 31, 2026
