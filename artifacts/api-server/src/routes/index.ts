import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import meRouter from "./me";
import suppliersDiscoverRouter from "./suppliersDiscover";
import preorderRouter from "./preorder";
import rollupRouter from "./rollup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(meRouter);
router.use(suppliersDiscoverRouter);
router.use(preorderRouter);
router.use(rollupRouter);

export default router;
