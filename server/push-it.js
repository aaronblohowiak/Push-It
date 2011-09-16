var sjs = require('sockjs'),
    uuid = require('uuid-pure').newId,
    help = require('./lib/help').help,
    inspect = require("sys").inspect,
    Agent = require("./models/agent"),
    Channel = require("./models/channel"),
    InMemoryMQ = require("./mqs/in_memory"),
    SubscriptionManager = require("./mqs/subscription_manager"),
    sys = require('sys'),
    EventEmitter = require('events').EventEmitter;

//TODO: real options parsing
var PushIt = function (server, options) {
  EventEmitter.apply(this, arguments);

  if(options.help) help();

  this.server = server;
  
  if (options.socket){
    this.sock = options.socket;
  }else{
    var sockjs_opts = {sockjs_url: "http://majek.github.com/sockjs-client/sockjs-latest.min.js"};
    var sjs_echo = new sjs.Server(sockjs_opts);
    sjs_echo.installHandlers(this.server, {prefix:'[/]pi/'});
    this.sock = sjs_echo;
  }

  var self = this;
  this.sock.on('open', function (client) {
    self.emit('connection', client);
  });
  if (!options.skipSetupIO) this.setupIO();
  
  this.mq = options.mq || new InMemoryMQ();

  this.channels = options.channels || {};
  this.subscriptionManager = options.subscriptionManager || new SubscriptionManager(this.mq);
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
  
  onDisconnect: function(agent){
    //null
  },
  
  setupIO: function () {
    var pushIt = this;
    
    this.sock.on('open', function(client){
      pushIt.__onConnection(client);
      
      client.on('message', function(message){
        pushIt.__onMessage(client, message.data);
      });

      client.on('close', function(){
        pushIt.__onDisconnect(client);
      });
    });
  },

  //this is when the sockjs connection happens
  __onConnection: function (client) {
    //setup authentication-request timeout, possibly
  },

  //this is when sockjs says there is a message
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
        channel: "/meta/error",
        data: "send only messages with a channel, a uuid and an agentId.",
        uuid: "???"
      });
    }
  },
  
  //make a subscription, no checks
  subscribe: function (channel, agent) {
    this.subscriptionManager.subscribe(channel, agent);
  },
  
  //go ahead and actually publish the message
  publish: function (channel, message) {
    if(typeof(channel) != "string"){
      channel = channel.name;
    }

    this.mq.publish(channel, {channel: channel, data: message});
  },
  
  //internal connect function, used to set up agent for request processing
  __connect: function (client, message) {
    //create a timeout/monitor
    var agent = new Agent({
        id: message.agentId,
        credentials: message.data.credentials || "",
        isConnected: false,
        client: client
      });
    
    agent["new"] = agent.stale = true;
    agent.requireConnection(this.TIMEOUTS.onConnectionRequest);
    
    this.onConnectionRequest(agent);
  },

  //internal subscription request processing, used to set up req context before auth decision
  __subscribe: function (client, message) {    
    if (message.data == undefined || message.data.channel == undefined) {
      message.successful = false;
      message.error = "you must have a data.channel in your subscribe message";
      return client.send(message);
    }
    
    var name = message.data.channel,
        self = this;
    
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
  
  //helper function for setting up event handling
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
  
  //get a channel by name or make a new one.
  channel: function (name) {
    var channel = this.channels[name];
    if(channel) return channel;
    return new Channel(name, this);
  },
  
  //set up the context for publication request processing
  __onPublicationRequest: function (client, message) {
    var self = this;
    
    this.__withAgent(client, message.agentId, function(err, agent){
       if(err){ 
         //change to publication failure
         var newMessage = {
           uuid: message.uuid,
           error: "unknown agentId",
           channel: "/meta/error"
         };
         client.send(newMessage);
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
  
  //when an agent disconnects, set up the context to handle that event.
  __onDisconnect: function (client) {
    var self = this,
        agentId = client.agentId;
    
    if(agentId){
      var agent = Agent.get(agentId, function(err, agent){
        if(err){ 
          console.log("Error getting agent "+ agentId + " on disconnect.");
        }else{
          Agent.remove(agentId);
          self.onDisconnect(agent);
        }
      });
    }
  },
  
  __metaRegexp: /^\/meta\/(.*)/,
  TIMEOUTS: {
    onConnectionRequest: 10000,
    onSubscriptionRequest: 1000,
    onPublicationRequest: 1000
  }
});

exports.PushIt = PushIt;
exports.Agent = Agent;