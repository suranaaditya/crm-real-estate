/* Evaluate the design prototype's app/data.js in Node and emit window.CRM_DATA
   as JSON. This gives the Python seeder the EXACT illustrative dataset the
   prototype renders (same seed=42 RNG), with zero hand-porting risk.

   Usage:  node gen_seed.js /path/to/data.js > seed_data.json
*/
const fs = require("fs");
const path = process.argv[2];
const window = {}; // data.js does: window.CRM_DATA = (() => {...})()
eval(fs.readFileSync(path, "utf8"));
process.stdout.write(JSON.stringify(window.CRM_DATA));
