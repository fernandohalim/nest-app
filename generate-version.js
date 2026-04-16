import { writeFileSync } from "fs";
import { version as _version } from "./package.json";

const versionData = {
  version: _version,
};

writeFileSync("./public/version.json", JSON.stringify(versionData, null, 2));

console.log(`✨ version.json generated with version ${_version}`);
