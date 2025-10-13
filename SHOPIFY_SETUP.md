# Shopify App Integration Setup Guide

## Overview

Fence Logic is now configured as a Shopify embedded app with two deployment modes:
1. **Admin Portal** - Embedded in Shopify Admin for managing products and pricing
2. **Storefront Calculator** - iframe embed on product pages for customer quotes

## Architecture

### Backend (Already Implemented ✅)
- **Shopify OAuth**: Secure authentication flow with offline access tokens
- **Session Management**: In-memory storage (upgrade to PostgreSQL recommended for production)
- **Session Token Validation**: App Bridge JWT tokens validated server-side (secure iframe auth)
- **HMAC Verification**: OAuth and webhook security middleware
- **CSP Headers**: Proper iframe permissions for Shopify embedding
- **REST API**: Product management, quote generation
- **PostgreSQL Database**: Persistent data storage

### Frontend (Partially Complete)
- **Admin UI**: Product catalog management (`/products`)
- **Calculator**: Multi-product fence configurator
- **Components**: Shadcn/ui + Tailwind CSS

---

## Step 1: Create Shopify App

### 1.1 Partner Account Setup
1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Create a partner account (free)
3. Navigate to **Apps** → **Create App** → **Create app manually**

### 1.2 App Configuration
**App Name**: `Fence Logic Calculator`

**App URL**: `https://your-replit-url.replit.app`

**Allowed redirection URL(s)**:
```
https://your-replit-url.replit.app/api/shopify/auth/callback
```

**App scopes** (OAuth):
- `read_products`
- `write_products`
- Add more as needed for your use case

### 1.3 Get API Credentials
After creating the app, you'll receive:
- **API Key** (Client ID)
- **API Secret** (Client Secret)

---

## Step 2: Configure Environment Variables

Add these to your Replit Secrets:

```bash
# Shopify Configuration
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
HOST=your-replit-url.replit.app

# Email Service (Choose one)
# Option A: SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Option B: Mailgun
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain

# Production/Development
NODE_ENV=development  # Set to 'production' when deploying
```

---

## Step 3: Install Shopify App

### 3.1 Generate Install URL
```
https://your-replit-url.replit.app/api/shopify/auth?shop=your-store.myshopify.com
```

Replace `your-store` with your actual Shopify store name.

### 3.2 Installation Flow
1. Visit the install URL in your browser
2. You'll be redirected to Shopify to approve permissions
3. After approval, you'll be redirected back to your app
4. Your app is now installed and authenticated!

---

## Step 4: Embed in Shopify Admin

### 4.1 Configure App Embed
In your Shopify Partner dashboard:
1. Go to **App Setup** → **Embedded app**
2. Enable **Embed your app in Shopify admin**
3. Set the **App home URL**: `/?embedded=1`

### 4.2 Admin Navigation
Once embedded, the app appears in:
- Shopify Admin → **Apps** → **Fence Logic Calculator**

### 4.3 Update Frontend for App Bridge
The admin UI needs to detect Shopify embedding and initialize App Bridge.

**Add to `client/src/App.tsx`:**
```tsx
import { useEffect, useState } from 'react';

function App() {
  const [isShopifyEmbedded, setIsShopifyEmbedded] = useState(false);
  
  useEffect(() => {
    // Check if running in Shopify iframe
    const urlParams = new URLSearchParams(window.location.search);
    const shopParam = urlParams.get('shop');
    const embedded = urlParams.get('embedded');
    
    if (shopParam || embedded) {
      setIsShopifyEmbedded(true);
      
      // Initialize Shopify App Bridge
      import('@shopify/app-bridge').then(({ default: createApp }) => {
        const app = createApp({
          apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
          host: urlParams.get('host') || '',
        });
      });
    }
  }, []);
  
  // Rest of your app...
}
```

---

## Step 5: Storefront Embed (Calculator)

### 5.1 Create App Extension (Theme App Extension)
In Shopify Partner dashboard:
1. Go to your app → **Extensions** → **Create Extension**
2. Choose **Theme App Extension**
3. This allows merchants to embed your calculator on product pages

### 5.2 Embed Code for Theme
Alternatively, provide this iframe code to merchants:

```liquid
<!-- Add to product.liquid or theme -->
<div id="fence-calculator-embed">
  <iframe 
    src="https://your-replit-url.replit.app/calculator?embedded=1&shop={{ shop.permanent_domain }}"
    width="100%"
    height="800px"
    frameborder="0"
    style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
  ></iframe>
</div>
```

### 5.3 Storefront Configuration
Calculator features available on storefront:
- ✅ Product selection (14 calculators)
- ✅ Visual fence builder
- ✅ Component list generation
- ✅ Email quotes (requires email service)
- ✅ PDF downloads (requires implementation)

---

## Step 6: Implement Email & PDF Features

### 6.1 Email Service Setup

**Using SendGrid (Recommended):**

```bash
# Install (already done)
npm install @sendgrid/mail

# Add to server/routes.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

app.post("/api/email-quote", async (req, res) => {
  const { email, design, components } = req.body;
  
  const msg = {
    to: email,
    from: 'quotes@yourstore.com', // Verify this email in SendGrid
    subject: 'Your Fence Logic Quote',
    html: `
      <h2>Your Fence Quote</h2>
      <p>Thank you for using Fence Logic Calculator!</p>
      <h3>Components:</h3>
      <ul>
        ${components.map(c => `<li>${c.qty}x ${c.description} - ${c.sku || 'N/A'}</li>`).join('')}
      </ul>
    `
  };
  
  await sgMail.send(msg);
  res.json({ success: true });
});
```

### 6.2 PDF Generation

**Using PDFKit (already installed):**

```typescript
// Add to server/routes.ts
import PDFDocument from 'pdfkit';

app.post("/api/download-quote", async (req, res) => {
  const { design, components } = req.body;
  
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=fence-quote.pdf');
  
  doc.pipe(res);
  
  doc.fontSize(20).text('Fence Logic Quote', 100, 100);
  doc.fontSize(12).text('Components:', 100, 150);
  
  let y = 180;
  components.forEach((comp: any) => {
    doc.text(`${comp.qty}x ${comp.description}`, 100, y);
    y += 20;
  });
  
  doc.end();
});
```

---

## Step 7: Testing Workflow

### 7.1 Admin Testing
1. Install app on development store
2. Navigate to **Apps** → **Fence Logic Calculator** in Shopify admin
3. Test product management:
   - Download CSV template
   - Import products
   - Edit pricing
   - Export products

### 7.2 Storefront Testing
1. Add calculator iframe to product page
2. Test configuration:
   - Select fence type
   - Configure spans
   - Add gates
   - Generate component list
3. Test quote functionality:
   - Email quote (check inbox)
   - Download PDF

### 7.3 OAuth Testing
1. Uninstall app from store
2. Reinstall using install URL
3. Verify permissions are requested
4. Confirm redirects work correctly

---

## Step 8: Production Deployment

### 8.1 Update Environment
```bash
NODE_ENV=production
HOST=your-production-domain.com
```

### 8.2 Database Migration
Ensure PostgreSQL is configured for production:
- Use Replit's built-in PostgreSQL or external provider
- Run migrations: `npm run db:push`

### 8.3 Publish Shopify App
In Partner dashboard:
1. Go to **Distribution** → **Shopify App Store**
2. Submit app for review (if making it public)
3. Or keep it as **Custom App** for private use

---

## API Endpoints Reference

### Shopify OAuth & Authentication
- `GET /api/shopify/auth?shop={store}` - Initiate OAuth flow
- `GET /api/shopify/auth/callback` - OAuth callback (handles authorization)
- `GET /api/shopify/verify` - Verify shop authentication status
- `POST /api/shopify/auth/session` - Validate App Bridge session token (JWT)
- `POST /api/shopify/webhooks/:topic` - Process verified Shopify webhooks

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/csv/template` - Download CSV template
- `GET /api/products/csv/export` - Export products
- `POST /api/products/csv/import` - Import products

### Calculator
- `POST /api/calculate-components` - Generate component list
- `POST /api/email-quote` - Send quote email
- `POST /api/download-quote` - Download PDF quote

### Designs
- `GET /api/designs` - List saved designs
- `POST /api/designs` - Save design
- `DELETE /api/designs/:id` - Delete design

---

## Troubleshooting

### Issue: "Invalid HMAC signature"
**Solution**: Verify `SHOPIFY_API_SECRET` matches your app credentials

### Issue: "CSP frame-ancestors error"
**Solution**: Ensure CSP headers allow Shopify domains (already configured)

### Issue: "Session not found"
**Solution**: Re-authenticate via `/api/shopify/auth?shop=yourstore.myshopify.com`

### Issue: App not loading in iframe
**Solution**: Check browser console for errors, verify App Bridge initialization

### Issue: Email not sending
**Solution**: 
- Verify SendGrid API key
- Check sender email is verified in SendGrid
- Review server logs for errors

---

## Security Checklist

- ✅ HMAC verification for OAuth
- ✅ CSP headers configured
- ✅ Session storage (upgrade to database in production)
- ✅ Environment variables for secrets
- ⬜ Rate limiting (recommended for production)
- ⬜ Webhook verification (for app uninstall events)
- ⬜ HTTPS enforcement (automatic on Replit)

---

## Next Steps

1. **Set up Shopify app** in Partner dashboard
2. **Add environment variables** in Replit Secrets
3. **Install app** on development store
4. **Configure email service** (SendGrid recommended)
5. **Implement PDF generation**
6. **Test complete flow**
7. **Deploy to production**

---

## Support Resources

- [Shopify App Development Docs](https://shopify.dev/docs/apps)
- [App Bridge Documentation](https://shopify.dev/docs/api/app-bridge)
- [Polaris Design System](https://polaris.shopify.com/)
- [SendGrid Documentation](https://docs.sendgrid.com/)

---

## Current Implementation Status

### ✅ Completed
- OAuth authentication system
- Session management (in-memory, upgrade to DB recommended)
- HMAC verification middleware
- CSP headers for iframe embedding
- Product catalog CRUD
- CSV import/export (RFC 4180 compliant)
- 14 calculator categories matching home navigation
- PostgreSQL database integration

### 🚧 In Progress
- App Bridge frontend integration
- Shopify Polaris UI components
- Email service implementation
- PDF generation

### 📋 Pending
- Storefront embed documentation
- Webhook handlers
- Production session storage (database)
- Rate limiting
- App distribution setup

---

**Need Help?** Check the Shopify Partner dashboard or review the implementation in:
- `server/shopify.ts` - OAuth & session management
- `server/shopify-routes.ts` - Authentication endpoints
- `server/routes.ts` - Main API routes
- `shared/schema.ts` - Database schema & categories
