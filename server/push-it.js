var socketIo = require(__dirname+'/lib/socket.io'),
    http = require('http'),
    uuid = require(__dirname+'/lib/uuid').uuid,
    help = require(__dirname+'/lib/help').help,
    inspect = require("sys").inspect;

var PushIt = function(server, options){
  if(!options.nohelp) help();
  
  this.server = server;
  this.io = socketIo.listen(this.server);
  
  this.setupIO();
};

var proto = {
  server: {},
  io: {}
};

proto.setupIO = function (){
  var pushIt = this;
  
  this.io.on('connection', function(client){
    pushIt.__onConnection(client);
    
  	client.on('message', function(message){
  	  pushIt.__onMessage(client, message);
  	});

  	client.on('disconnect', function(){
      pushIt.__onDisconnect(client);
  	});
  });
};

proto.__onConnection = function (client){
  //setup authentication-request timeout, possibly
};

proto.__onMessage = function(client, message){
  //dispatch message
  if(message.channel && message.uuid  && message.agentId){
    if(message.channel.substring(0, 6) == "/meta/"){
      //i am evil. buahahahahahahaha
      proto["__"+message.channel.substring(6)](client, message);
    }else{
      //publication request
      proto.__onPublicationRequest(client, message);
    }
  }else{
    client.send({
      "channel":"/meta/wtf",
      "data":"only messages with a channel, a uuid and an agentId.",
      "uuid":"???"
    });
  }
};

proto.__connect = function(client, message){
  //create a timeout/monitor
  
};

proto.__onPublicationRequest = function (client, message){
  console.log("publication request:", inspect(message));
};

proto.__onDisconnect = function(client){
  
};

proto.__metaRegexp = /^\/meta\/(.*)/;

PushIt.prototype = proto;

exports.PushIt = PushIt;