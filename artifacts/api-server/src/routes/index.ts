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
import trayScanRouter from "./trayScan";
import { pushRouter } from "./push";
import recipeLibraryRouter from "./recipeLibrary";
import foodLookupRouter from "./foodLookup";
import iyverisRouter from "./iyveris";
import leadsRouter from "./leads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(trayScanRouter);
router.use(meRouter);
router.use(suppliersDiscoverRouter);
router.use(producersDiscoverRouter);
router.use(preorderRouter);
router.use(rollupRouter);
router.use(mailRouter);
router.use(tseRouter);
router.use(demoAuthRouter);
router.use(pushRouter);
router.use(recipeLibraryRouter);
router.use(foodLookupRouter);
router.use(iyverisRouter);
router.use(leadsRouter);

export default router;
