import fs from "fs";
import path from "path";

// read the package.json file as plain text to bypass strict node 24 json import rules
const packagePath = path.join(process.cwd(), "package.json");
const packageData = JSON.parse(fs.readFileSync(packagePath, "utf8"));

// write it to the public folder
const outputPath = path.join(process.cwd(), "public", "version.json");
fs.writeFileSync(
  outputPath,
  JSON.stringify({ version: packageData.version }, null, 2),
);

console.log(`✨ version.json generated with version ${packageData.version}`);
