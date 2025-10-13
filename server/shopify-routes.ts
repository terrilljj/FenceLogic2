import { Express, Request, Response } from "express";
import crypto from "crypto";
import {
  shopify,
  isShopifyConfigured,
  storeSession,
  loadSession,
  deleteSession,
  verifyShopifyHMAC,
  verifyShopDomain,
  ensureShopifyAuth,
  getSessionId,
} from "./shopify";

export function setupShopifyRoutes(app: Express) {
  // Return early if Shopify is not configured
  if (!isShopifyConfigured || !shopify) {
    console.log("Shopify not configured - skipping Shopify routes");
    return;
  }
  // OAuth - Step 1: Initiate OAuth
  app.get("/api/shopify/auth", verifyShopDomain, async (req: Request, res: Response) => {
    try {
      const shop = req.query.shop as string;
      
      // Create authorization URL
      const authRoute = await shopify.auth.begin({
        shop: shopify.utils.sanitizeShop(shop, true)!,
        callbackPath: "/api/shopify/auth/callback",
        isOnline: false, // Offline token for long-term access
        rawRequest: req,
        rawResponse: res,
      });

      // Store the session before redirecting
      await storeSession(authRoute.session);
      
      res.redirect(authRoute.redirectUrl);
    } catch (error) {
      console.error("Error initiating Shopify OAuth:", error);
      res.status(500).send("Failed to initiate OAuth");
    }
  });

  // OAuth - Step 2: Callback
  app.get("/api/shopify/auth/callback", async (req: Request, res: Response) => {
    try {
      const callback = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      // Store the authenticated session
      await storeSession(callback.session);

      const { shop } = callback.session;
      const host = req.query.host as string;

      // Redirect to embedded app admin with shop and host params
      res.redirect(`/?shop=${shop}&host=${host}`);
    } catch (error) {
      console.error("Error in Shopify OAuth callback:", error);
      res.status(500).send("OAuth callback failed");
    }
  });

  // Verify request is authenticated
  app.get("/api/shopify/verify", ensureShopifyAuth, (req: Request, res: Response) => {
    const session = (req as any).shopifySession;
    res.json({
      authenticated: true,
      shop: session.shop,
      scope: session.scope,
    });
  });

  // Get shop information
  app.get("/api/shopify/shop", ensureShopifyAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).shopifySession;
      const client = new shopify.clients.Rest({ session });
      
      const response = await client.get({
        path: "shop",
      });

      res.json(response.body);
    } catch (error) {
      console.error("Error fetching shop info:", error);
      res.status(500).json({ error: "Failed to fetch shop information" });
    }
  });

  // Validate Shopify Session Token (JWT from App Bridge)
  app.post("/api/shopify/auth/session", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing session token" });
      }

      const sessionToken = authHeader.replace("Bearer ", "");
      
      // Validate the session token from App Bridge
      const payload = await shopify.session.decodeSessionToken(sessionToken);
      const shop = payload.dest.replace("https://", "");
      
      // Load the offline session for this shop
      const sessionId = shopify.session.getOfflineId(shop);
      const session = await loadSession(sessionId);

      if (!session || !session.accessToken) {
        return res.status(401).json({ error: "No valid session found" });
      }

      // Return session info (NOT the access token)
      res.json({
        shop: session.shop,
        scope: session.scope,
        authenticated: true,
      });
    } catch (error) {
      console.error("Error validating session token:", error);
      res.status(401).json({ error: "Invalid session token" });
    }
  });

  // Webhook verification and processing endpoint
  app.post("/api/shopify/webhooks/:topic", async (req: Request, res: Response) => {
    try {
      const topic = req.params.topic;
      const hmac = req.get("X-Shopify-Hmac-Sha256");
      const shop = req.get("X-Shopify-Shop-Domain");

      if (!hmac || !shop) {
        return res.status(400).send("Missing webhook headers");
      }

      // Verify webhook HMAC
      const rawBody = JSON.stringify(req.body);
      const hash = crypto
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET || "")
        .update(rawBody, 'utf8')
        .digest('base64');

      if (hash !== hmac) {
        console.error(`Invalid webhook HMAC for topic: ${topic} from ${shop}`);
        return res.status(401).send("Invalid HMAC signature");
      }

      // Process verified webhook
      console.log(`Verified webhook: ${topic} from ${shop}`);
      
      // Handle different webhook topics
      switch (topic) {
        case "app/uninstalled":
          // Clean up shop data when app is uninstalled
          const sessionId = shopify.session.getOfflineId(shop);
          await deleteSession(sessionId);
          console.log(`App uninstalled from ${shop}, session deleted`);
          break;
        
        case "products/create":
        case "products/update":
        case "products/delete":
          // Handle product webhooks if needed
          console.log(`Product webhook: ${topic}`, req.body);
          break;
        
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }
      
      res.status(200).send("Webhook processed");
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).send("Webhook processing failed");
    }
  });
}
