var PushIt = require (__dirname + '/../../server/push-it').PushIt,
    fs = require('fs');

/* this gets passed through to http.createServer */
var connectionHandler = function(req, res){
  
  
};

try{
  var options = JSON.parse(fs.readFileSync(__dirname+"/options.json"))  
}catch(e){
  console.error("Could not load the options file!");
  console.error(e.toString());
  process.exit()
}

var pi = new PushIt(connectionHandler, options);