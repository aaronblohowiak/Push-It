var socketIo = require(__dirname+'/lib/socket.io'),
    http = require('http');

var PushIt = function(handler, options){
 
  server = http.createServer(handler);
  server.listen(options.port, null);

  this.io = socketIo.listen(server);
  
  this.setupIO();
};

var proto = {};

proto.setupIO = function (){
  this.io.on('connection', function(client){
  	client.send({ buffer: buffer });
  	client.broadcast({ announcement: client.sessionId + ' connected' });

  	client.on('message', function(message){
  		var msg = { message: [client.sessionId, message] };
  		buffer.push(msg);
  		if (buffer.length > 15) buffer.shift();
  		client.broadcast(msg);
  	});

  	client.on('disconnect', function(){
  		client.broadcast({ announcement: client.sessionId + ' disconnected' });
  	});
  });
};

PushIt.prototype = proto;

exports.PushIt = PushIt;