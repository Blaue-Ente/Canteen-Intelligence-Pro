import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export interface AuthedRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId =
    (auth?.sessionClaims as Record<string, unknown> | undefined)?.userId as
      | string
      | undefined ?? auth?.userId ?? null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
