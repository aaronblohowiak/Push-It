var read = require('fs').readFileSync;

exports.help = function(){
  console.log("\n\n================ BEGINNING OF HELP ==========");
  console.log(read(__dirname+"/../help.txt", "utf8"));  
  console.log("================ END OF HELP ==========\n\n");  
  
}
