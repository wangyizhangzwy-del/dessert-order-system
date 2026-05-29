import { runParserRegressionChecks } from "@/lib/parserRegression";

function main() {
  const errors = runParserRegressionChecks();
  if (errors.length > 0) {
    console.error("Parser regression failed:");
    errors.forEach((e, idx) => console.error(`${idx + 1}. ${e}`));
    process.exit(1);
  }
  console.log("Parser regression passed.");
  process.exit(0);
}

main();
