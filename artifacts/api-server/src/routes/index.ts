import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import meRouter from "./me";
import suppliersDiscoverRouter from "./suppliersDiscover";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(meRouter);
router.use(suppliersDiscoverRouter);

export default router;
