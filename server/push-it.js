require.paths.unshift(__dirname+"/lib/");
require.paths.unshift(__dirname+"/models/");
require.paths.unshift(__dirname+"/mqs/");

var socketIo = require('socket.io')
  , uuid = require('uuid-pure').newId
  , help = require('help').help
  , inspect = require("sys").inspect
  , Agent = require("agent")
  , Channel = require("channel")
  , InMemoryMQ = require("in_memory")
  , SubscriptionManager = require("subscription_manager")
  , sys = require('sys')
  , EventEmitter = require('events').EventEmitter;

//TODO: real options parsing
var PushIt = function (server, options) {
  EventEmitter.apply(this, arguments);

  if(!options.nohelp) help();
  
  this.server = server;
  this.io = options.socket || socketIo.listen(this.server);  
  var self = this;
  this.io.on('connection', function (client) {
    self.emit('connection', client);
  });
//  this.setupIO();
  
  this.mq = new InMemoryMQ();

  this.channels = {};
  this.subscriptionManager = new SubscriptionManager(this.mq);
};

PushIt.prototype.__proto__ = EventEmitter.prototype;

function extend (a, b) {
  for (var k in b) {
    a[k] = b[k];
  }
}

extend(PushIt.prototype, {
  server: {},
  io: {},
  pants: 'ho',
  channels: {},
  onConnectionRequest: function (agent) {
    agent.connected();
  },
  onSubscriptionRequest: function (channel, agent) {
    agent.subscribe(channel);
  },
  onPublicationRequest: function (channel, agent, message) {
    channel.publish(message);
    agent.publicationSuccess(message);
  },
//  setupIO: function () {
//    var pushIt = this;
//    
//    this.io.on('connection', function(client){
//      pushIt.__onConnection(client);
//      
//      client.on('message', function(message){
//        pushIt.__onMessage(client, message);
//      });
//
//      client.on('disconnect', function(){
//        pushIt.__onDisconnect(client);
//      });
//    });
//  },
  __onConnection: function (client) {
    //setup authentication-request timeout, possibly
  },
  __onMessage: function (client, message) {
    var handler, requestKind;

    //verify required fields
    if ( message.channel && message.uuid  && message.agentId ) {
      switch (message.channel) {
        case "/meta/connect":
          this.__connect(client, message);
          break;
        case "/meta/subscribe":
          this.__subscribe(client, message);
          break;
        default:
          this.__onPublicationRequest(client, message); 
      }
    } else {
      client.send({
          channel: "/meta/error"
        , data: "send only messages with a channel, a uuid and an agentId."
        , uuid: "???"
      });
    }
  },
  subscribe: function (channel, agent) {
    this.subscriptionManager.subscribe(channel, agent);
  },
  publish: function (channel, message) {
    this.mq.publish(channel.name, message);
  },
  __connect: function (client, message) {
    //create a timeout/monitor
    var agent = new Agent({
          id: message.agentId
        , credentials: message.data.credentials || ""
        , isConnected: false
      });
    
    agent["new"] = agent.stale = true;
    agent.client = client;
    agent.requireConnection(this.TIMEOUTS.onConnectionRequest);
    
    this.onConnectionRequest(agent);
  },
  __subscribe: function (client, message) {
    if (message.data == undefined || message.data.channel == undefined) {
      message.successful = false;
      message.error = "you must have a data.channel in your subscribe message";
      return client.send(message);
    }
    
    var name = message.data.channel 
      , self = this;
    
    this.__withAgent(client, message.agentId, function (err, agent) {
      if (err) { 
        message.successful = false;
        message.error = "unknown agentId";
        agent.send(message);
        return;
      }

      var channel = self.channel(name);
      agent.client = client;

      agent.requireSubscription(self.TIMEOUTS.onSubscriptionRequest, message, channel);

      if (channel.onSubscriptionRequest) {
        channel.onSubscriptionRequest(channel, agent);
      } else {
        self.onSubscriptionRequest(channel, agent);
      }
    });
  },
  __withAgent: function (client, agentId, fn) {
    Agent.get(agentId, function(err, agent){
      if(err) return fn(err);
      if(agent){
        agent.client = client;
        return fn(undefined, agent);
      };

      return fn("no agent");
    });
  },
  channel: function (name) {
    var channel = this.channels[name];
    if(channel) return channel;
    return new Channel(name, this);
  },
  __onPublicationRequest: function (client, message) {
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
            
       agent.requirePublication(self.TIMEOUTS.onPublicationRequest, message, channel);
       
       if(channel.onPublicationRequest){
         channel.onPublicationRequest(channel, agent, message);
       }else{
         self.onPublicationRequest(channel, agent, message);
       }
    });
  },
  __onDisconnect: function (client) {
    null;
  },
  __metaRegexp: /^\/meta\/(.*)/,
  TIMEOUTS: {
    onConnectionRequest: 10000,
    onSubscriptionRequest: 100,
    onPublicationRequest: 100
  }
});

exports.PushIt = PushIt;
