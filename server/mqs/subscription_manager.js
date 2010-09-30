//this does three things:
//  first, it ensures that we are subscribed to all channels on mq for all our agents.
//  secondly, it ensures that messages that are recieved are dispatched appropriately.
//  finally, it decrements or unsubscribes from channels when there are no more agents listening on them.
var SubscriptionManager = function(mq){
  this.mq = mq;
  this.subscriptions = {};
};

var proto = {};
SubscriptionManager.prototype = proto;

proto.subscriptions = {};

proto.subscribe = function(channel, agent){
  var self = this, chan = channel.name;
    
  if(this.subscriptions[chan]){
    this.subscriptions[chan].addAgent(agent);
  }else{  
    this.subscriptions[chan] = new SubscriptionSet();
    this.subscriptions[chan].addAgent(agent);
    
    this.mq.subscribe(chan, function(message){
      self.received(chan, message);
    });
  }
};

proto.received = function(chan, message){
  var ss = this.subscriptions[chan];
  if(ss){
    for(var agentId in ss.agents){
      ss.agents[agentId].send(message);
    }
  }
};

proto.unsubscribe = function(channel, agent){
  var chan = channel.name;
  
  if(this.subscriptions[chan]){
    var countLeft = this.subscriptions[chan].removeAgent(agent);
    if(countLeft == 0){
      this.mq.unsubscribe(chan);
    }
  }
};

function SubscriptionSet(){
  this.agents = {};
  this.count = 0;
};

SubscriptionSet.prototype = {
  agents: {},
  count: 0,
  addAgent: function(agent){
    if(this.agents[agent.id]) return this.count;
    
    this.agents[agent.id] = agent;
    this.count = this.count + 1;
    return this.count;
  },
  removeAgent: function(agent){
    if(this.agents[agent.id]){
      delete this.agents[agent.id];
      this.count = this.count - 1;
    }
    return this.count;
  }
};

module.exports = SubscriptionManager;
