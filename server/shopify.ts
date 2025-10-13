import "@shopify/shopify-api/adapters/node";
import { shopifyApi, Session, ApiVersion, Shopify } from "@shopify/shopify-api";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// Check if Shopify is configured
export const isShopifyConfigured = Boolean(
  process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET
);

// Shopify API configuration (only initialize if credentials are present)
export const shopify: Shopify | null = isShopifyConfigured
  ? shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY!,
      apiSecretKey: process.env.SHOPIFY_API_SECRET!,
      scopes: ["read_products", "write_products"], // Add scopes as needed
      hostName: process.env.HOST || "localhost:5000",
      hostScheme: process.env.NODE_ENV === "production" ? "https" : "http",
      apiVersion: ApiVersion.October24,
      isEmbeddedApp: true, // Embedded in Shopify admin
      isCustomStoreApp: false,
    })
  : null;

// Session storage interface
interface SessionData {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  accessToken?: string;
  scope?: string;
  expires?: Date;
}

// In-memory session storage (replace with database in production)
const sessionStorage = new Map<string, SessionData>();

export const storeSession = async (session: Session): Promise<boolean> => {
  sessionStorage.set(session.id, {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    accessToken: session.accessToken,
    scope: session.scope,
    expires: session.expires,
  });
  return true;
};

export const loadSession = async (id: string): Promise<Session | undefined> => {
  const sessionData = sessionStorage.get(id);
  if (!sessionData) return undefined;

  return new Session(sessionData);
};

export const deleteSession = async (id: string): Promise<boolean> => {
  sessionStorage.delete(id);
  return true;
};

// Middleware to verify Shopify HMAC
export const verifyShopifyHMAC = (req: Request, res: Response, next: NextFunction) => {
  const { hmac, shop, ...params } = req.query;

  if (!hmac || !shop) {
    return res.status(400).send("Missing HMAC or shop parameter");
  }

  // Build query string without HMAC
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  // Verify HMAC
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || "")
    .update(message)
    .digest('hex');

  if (hash !== hmac) {
    return res.status(403).send("Invalid HMAC signature");
  }

  next();
};

// Middleware to verify shop domain
export const verifyShopDomain = (req: Request, res: Response, next: NextFunction) => {
  const shop = req.query.shop as string;

  if (!shop || !shopify.utils.sanitizeShop(shop, true)) {
    return res.status(400).send("Invalid shop domain");
  }

  next();
};

// Get session ID from request
export const getSessionId = (req: Request): string => {
  const shop = req.query.shop as string;
  return shopify.session.getOfflineId(shop);
};

// Middleware to ensure authenticated Shopify session
export const ensureShopifyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sessionId = getSessionId(req);
  const session = await loadSession(sessionId);

  if (!session || !session.accessToken) {
    const shop = req.query.shop as string;
    return res.redirect(`/api/shopify/auth?shop=${shop}`);
  }

  // Attach session to request
  (req as any).shopifySession = session;
  next();
};
