import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import meRouter from "./me";
import suppliersDiscoverRouter from "./suppliersDiscover";
import producersDiscoverRouter from "./producersDiscover";
import preorderRouter from "./preorder";
import rollupRouter from "./rollup";
import mailRouter from "./mail";
import tseRouter from "./tse";
import demoAuthRouter from "./demoAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(meRouter);
router.use(suppliersDiscoverRouter);
router.use(producersDiscoverRouter);
router.use(preorderRouter);
router.use(rollupRouter);
router.use(mailRouter);
router.use(tseRouter);
router.use(demoAuthRouter);

export default router;
