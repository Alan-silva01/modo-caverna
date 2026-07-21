const fs = require('fs');
const content = fs.readFileSync('supabase/functions/generate-questions/index.ts', 'utf8');
console.log(JSON.stringify(content));
