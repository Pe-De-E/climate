import "dotenv/config";
import { connectDB } from "../db.js";
import { getOrBuildAnomalyGrid } from "../services/globalGrid.js";

const DEFAULT_YEARS_AGO = 40;
const RESOLUTION = 2;

async function main() {
  await connectDB();

  const lastFullYear = new Date().getUTCFullYear() - 1;
  const year1 = lastFullYear - DEFAULT_YEARS_AGO;
  const year2 = lastFullYear;

  console.log(
    `warming global grid cache: resolution=${RESOLUTION}° years=${year1}/${year2}`,
  );
  const start = Date.now();

  const { cells, requested, failed } = await getOrBuildAnomalyGrid(
    RESOLUTION,
    year1,
    year2,
  );

  const seconds = Math.round((Date.now() - start) / 1000);
  console.log(
    `done in ${seconds}s: ${cells.length}/${requested} cells cached (${failed} failed)`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("warm-up failed:", error);
  process.exit(1);
});
