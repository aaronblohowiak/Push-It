var test = {},
    InMemoryMQ = require('in_memory'),
    SubscriptionManager = require('subscription_manager'),
    proto = require('push-it-proto'),
    agent = require('agent'),
    assert = require('assert');
    
    
function PushIt(){
  this.mq = new InMemoryMQ();

  this.channels = {};
  this.subscriptionManager = new SubscriptionManager(this.mq);
}


PushIt.prototype = proto;

function TestClient(){ this.count = 0; this.sentMessages = []; };
TestClient.prototype = {
  count: 0,
  sentMessages: [],
  
  send: function(message){
    this.sentMessages.push(message);
  },
  
  lastMessage: function(){
    return this.sentMessages[this.sentMessages.length - 1];
  }
};

function shortenTimeouts(pi){
  var hsh = {};
  for(var k in pi.TIMEOUTS){
    hsh[k] = 50;
  }
  pi.TIMEOUTS = hsh;
  return pi;
};

function connectionRequestMessage(){
  return {uuid: "uuid1", channel:"/meta/connect", agentId: "agentId", data:{ credentials: "its meee" }};
};

function subscriptionRequestMessage(){
  return {uuid: "uuid1", channel:"/meta/subscribe", agentId: "agentId", data:{ channel: "its meee" }};
};

function publicationRequestMessage(){
  return {uuid: "uuid1", channel:"pants", agentId: "agentId", data:"who framed roger rabbit?"};
};

test["connect with an invalid message sends error"] = function(){
  var pi = new PushIt;
  var client = new TestClient();
  pi.__onMessage(client, {uuid: "uuid1", channel:"/meta/connect"});
  assert.equal(client.lastMessage().channel, "/meta/error");
};



test["connect with a valid message sends success"] = function(){
  var pi = new PushIt;
  var client = new TestClient();

  pi.__onMessage(client, connectionRequestMessage());
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/connect");
  assert.equal(lm.successful, true);
};


test["custom filter should prevent connection"] = function(){
  var pi = new PushIt;
  
  pi.onConnectionRequest = function(agent){
    agent.connectionDenied("you stink!");
  };
  
  var client = new TestClient();

  pi.__onMessage(client, connectionRequestMessage());
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/connect");
  assert.equal(lm.successful, false);
};


test["custom filter that does nothing should prevent connection"] = function(beforeExit){
  var pi = new PushIt;
  var n = 0;
  
  pi = shortenTimeouts(pi);
  
  pi.onConnectionRequest = function(agent){
  };
  
  var client = new TestClient();

  pi.__onMessage(client, connectionRequestMessage());

  setTimeout(function(){
    var lm = client.lastMessage();
    assert.equal(lm.channel, "/meta/connect");
    assert.equal(lm.successful, false);
    n++;
  }, 100);
  
  beforeExit(function(){
    assert.equal(n, 1);
  });
};


test["subscribe with default function should return a success"] = function(){
  var pi = new PushIt;
  var client = new TestClient();

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, subscriptionRequestMessage());
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/subscribe");
  assert.equal(lm.successful, true);
};


test["custom filter should prevent subscription"] = function(){
  var pi = new PushIt;
  var client = new TestClient();
  
  pi.onSubscriptionRequest = function(channel, agent){
    agent.subscriptionDenied(channel, "you stink!");
  };

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, subscriptionRequestMessage());
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/subscribe");
  assert.equal(lm.successful, false);
};


test["custom channel filter should prevent subscription"] = function(){
  var pi = new PushIt;
  var client = new TestClient();
  var subMsg =  subscriptionRequestMessage();

  channel = pi.channel(subMsg.data.channel);

  channel.onSubscriptionRequest = function(channel, agent){
    agent.subscriptionDenied(channel, "you stink!");
  };

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, subMsg);
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/subscribe");
  assert.equal(lm.successful, false);
};

test["require a channel to have a subscription"] = function(){
  var pi = new PushIt;
  var client = new TestClient();

  var sub = subscriptionRequestMessage();
  delete sub.data;
  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, sub);
  var lm = client.lastMessage();
  assert.equal(lm.channel, "/meta/subscribe");
  assert.equal(lm.successful, false);
};



test["custom filter that does nothing should prevent subscription"] = function( beforeExit){
  var pi = new PushIt;
  var client = new TestClient();
  
  var n = 0;
  
  pi = shortenTimeouts(pi);
  
  pi.onSubscriptionRequest = function(channel, agent){
  };

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, subscriptionRequestMessage());

  setTimeout(function(){
    var lm = client.lastMessage();
    assert.equal(lm.channel, "/meta/subscribe");
    assert.equal(lm.successful, false);
    n++;
  }, 100);
  
  beforeExit(function(){
    assert.equal(n, 1);
  });
};



test["custom filter that does nothing should prevent publication"] = function(beforeExit){
  var pi = new PushIt;
  var client = new TestClient();
  var pubMsg = publicationRequestMessage();
  var n = 0;
  
  pi = shortenTimeouts(pi);
  
  pi.onPublicationRquest = function(channel, agent){
  };

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, pubMsg);

  setTimeout(function(){
    var lm = client.lastMessage();
    assert.equal(lm.channel, pubMsg.channel);
    assert.equal(lm.successful, false);
    n++;
  }, 100);
  
  beforeExit(function(){
    assert.equal(n, 1);
  });
};


test["publishing should be successful by default"] = function(){
  var pi = new PushIt;
  var client = new TestClient();

  pi.__onMessage(client, connectionRequestMessage());
  pi.__onMessage(client, subscriptionRequestMessage());
  pi.__onMessage(client, publicationRequestMessage());
  
  var lm = client.lastMessage();
  assert.equal(lm.channel, "pants");
  assert.equal(lm.successful, true);
};


test["publishing with deleted agent sends error"] = function(){
  var pi = new PushIt;
  var client = new TestClient();
  var req = connectionRequestMessage(), pub = publicationRequestMessage();

  var agentId = "uniq to this test";
  req.agentId = agentId;
  pub.agentId = agentId;
  

  pi.__onMessage(client, req);
  delete agent.agents[agentId];
  
  pi.__onMessage(client, pub);
  

  assert.equal(client.lastMessage().successful, false);
};


module.exports = test;
