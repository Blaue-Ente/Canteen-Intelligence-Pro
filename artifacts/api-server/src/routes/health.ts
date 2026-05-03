import { Router, type IRouter } from "express";
import { schemas, type HealthStatus } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data: HealthStatus = schemas.HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
