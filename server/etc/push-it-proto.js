Agent = require('agent');
Channel = require('channel');


var proto = {
  server: {},
  io: {},
  pants: "ho",
  channels: {}
};

proto.onConnectionRequest = function(agent){
  agent.connected();
};

proto.onSubscriptionRequest = function(channel, agent){
  agent.subscribe(channel);
};

proto.onPublicationRquest = function(channel, agent, message){
  channel.publish(message);
  agent.publicationSuccess(message);
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
  if(message.channel && message.uuid  && message.agentId ){
    if(message.channel.substring(0, 6) == "/meta/"){
      //i am evil. buahahahahahahaha
      this["__"+message.channel.substring(6)](client, message);
    }else{
      //publication request
      this.__onPublicationRequest(client, message);
    }
  }else{
    client.send({
      "channel":"/meta/error",
      "data":"send only messages with a channel, a uuid and an agentId.",
      "uuid":"???"
    });
  }
};

proto.subscribe = function(channel, agent){
  this.subscriptionManager.subscribe(channel, agent);
};

proto.publish = function(channel, message){
  this.mq.publish(channel.name, message);
};

proto.__connect = function(client, message){
  //create a timeout/monitor
  var agent = new Agent({
      id: message.agentId,
      credentials: message.data.credentials || "",
      isConnected: false
    });
  
  agent["new"] = agent.stale = true;
  agent.client = client;
  agent.requireConnection(this.TIMEOUTS.onConnectionRequest);
  
  this.onConnectionRequest(agent);
};

proto.__subscribe = function(client, message){ 
  
  if(message.data == undefined || message.data.channel == undefined){
    message.successful = false;
    message.error = "you must have a data.channel in your subscribe message";
    return client.send(message);
  };
  
  var name = message.data.channel; 
  var self = this;
  
  this.__withAgent(client, message.agentId, function(err, agent){
     if(err){ 
       message.successful = false;
       message.error = "unknown agentId";
       agent.send(message);
       return;
     }

     var channel = self.channel(name);
     agent.client = client;
     
     agent.requireSubscription(self.TIMEOUTS.onSubscriptionRequest, message, channel);
     
     if(channel.onSubscriptionRequest){
       channel.onSubscriptionRequest(channel, agent);
     }else{
       self.onSubscriptionRequest(channel, agent);
     }
  });
};

proto.__withAgent = function(client, agentId, fn){
  Agent.get(agentId, function(err, agent){
    if(err) return fn(err);
    if(agent){
      agent.client = client;
      return fn(undefined, agent);
    };

    return fn("no agent");
  });
};

proto.channel = function(name){
  var channel = this.channels[name];
  if(channel) return channel;
  return new Channel(name, this);
};

proto.__onPublicationRequest = function (client, message){
  var self = this;
  
  this.__withAgent(client, message.agentId, function(err, agent){
     if(err){ 
       message.successful = false;
       message.error = "unknown agentId";
       client.send(message);
       return;
     }
     
     var chan = message.channel;
     var channel = self.channel(chan);
          
     agent.requirePublication(self.TIMEOUTS.onPublicationRquest, message, channel);
     
     if(channel.onPublicationRquest){
       channel.onPublicationRquest(channel, agent, message);
     }else{
       self.onPublicationRquest(channel, agent, message);
     }
  });
};

proto.__onDisconnect = function(client){
  null;
};

proto.__metaRegexp = /^\/meta\/(.*)/;

proto.TIMEOUTS = {
  onConnectionRequest: 10000,
  onSubscriptionRequest: 100
};

module.exports = proto;
