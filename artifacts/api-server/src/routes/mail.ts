import { Router, type IRouter, type Request, type Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();

interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface OutlookResponse {
  value: OutlookMessage[];
  "@odata.nextLink"?: string;
}

// GET /api/mail/inbox?top=20&filter=catering
router.get("/mail/inbox", async (req: Request, res: Response) => {
  try {
    const connectors = new ReplitConnectors();
    const topRaw = Array.isArray(req.query["top"]) ? req.query["top"][0] : req.query["top"];
    const top = Math.min(Number(topRaw) || 20, 50);
    const filterRaw = Array.isArray(req.query["filter"]) ? req.query["filter"][0] : req.query["filter"];
    const filter = (filterRaw as string | undefined)?.toLowerCase();

    // Fetch messages from Microsoft Graph
    const params = new URLSearchParams({
      $top: String(top),
      $orderby: "receivedDateTime desc",
      $select: "id,subject,bodyPreview,from,receivedDateTime,isRead,hasAttachments",
    });
    if (filter) {
      params.set(
        "$filter",
        `contains(tolower(subject),'${filter}') or contains(tolower(bodyPreview),'${filter}')`,
      );
    }

    const response = await connectors.proxy(
      "outlook",
      `/v1.0/me/messages?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      const errText = await response.text();
      req.log.error({ status: response.status, body: errText }, "Graph API error");
      res.status(response.status).json({ error: `Graph API error: ${response.status}` });
      return;
    }

    const data = (await response.json()) as OutlookResponse;
    res.json({ messages: data.value ?? [] });
  } catch (err) {
    req.log.error({ err }, "mail inbox error");
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// GET /api/mail/message/:id — full body
router.get("/mail/message/:id", async (req: Request, res: Response) => {
  try {
    const connectors = new ReplitConnectors();
    const id = String(req.params["id"]);

    const response = await connectors.proxy(
      "outlook",
      `/v1.0/me/messages/${encodeURIComponent(id)}?$select=id,subject,body,from,receivedDateTime,isRead,hasAttachments`,
      { method: "GET" },
    );

    if (!response.ok) {
      res.status(response.status).json({ error: `Graph API error: ${response.status}` });
      return;
    }

    const msg = (await response.json()) as OutlookMessage;
    res.json({ message: msg });
  } catch (err) {
    req.log.error({ err }, "mail message error");
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

// PATCH /api/mail/message/:id/read — mark as read
router.patch("/mail/message/:id/read", async (req: Request, res: Response) => {
  try {
    const connectors = new ReplitConnectors();
    const id = String(req.params["id"]);

    const response = await connectors.proxy(
      "outlook",
      `/v1.0/me/messages/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      },
    );

    if (!response.ok) {
      res.status(response.status).json({ error: `Graph API error: ${response.status}` });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "mail mark-read error");
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
});

export default router;
