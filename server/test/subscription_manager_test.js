var test = {},
    SM = require('subscription_manager'),
    MQ = require('in_memory'),
    assert = require('assert');

function propertyCount(obj){
  var key = "";
  var i = 0;

  for( key in obj){
    i++;
  }

  return i;
}

function TestClient(){ this.count = 0; this.sentMessages = []; };
TestClient.prototype = {
  count: 0,
  sentMessages: [],
  
  send: function(message){
    this.sentMessages.push(message);
  }
}

function TestAgent(){
  this.id = Math.floor(Math.random() * 10000000).toString();
  this.client = new TestClient(); 
}

TestAgent.prototype = {
  id : "replaceme",
  client : { },
  send: function(msg){
    this.client.send(msg);
  }
}

function newSMtest(){
  return {
    sm: new SM(new MQ),

    mqSubscriptions: function(){
      return propertyCount(this.sm.mq.exactSubscriptions);
    },
    
    agent: new TestAgent(),
    agent2: new TestAgent()
  };
}



test['first subscription creates mq subscription'] = function(){
    var t = new newSMtest();
    var sm = t.sm, agent = t.agent, agent2 = t.agent2;
    var before_length = t.mqSubscriptions();
    
    sm.subscribe({name: "one exact"}, agent);
    assert.equal(t.mqSubscriptions(), before_length + 1);
};


test['additional subscription on same channel does not create an additional mq subscription'] = function(){
    var t = new newSMtest();
    var sm = t.sm, agent = t.agent, agent2 = t.agent2;

    sm.subscribe({name: "one exact"}, agent);
    var before_length = t.mqSubscriptions();
    sm.subscribe({name: "one exact"}, agent2);
    
    assert.equal(t.mqSubscriptions(), before_length);
};

test['a message sent to a channel should be sent to the subscribed agent.'] = function(beforeExit){
    var t = new newSMtest();
    var sm = t.sm, agent = t.agent, agent2 = t.agent2, n=0;
    
    sm.subscribe({name: "one exact"}, agent);
    sm.mq.publish("one exact", "PANTALONES!");
    
    setTimeout(function(){
      n++;
      assert.equal(agent.client.sentMessages[0], "PANTALONES!")
    }, 20)
    
    beforeExit(function(){
      assert.equal(1, n, "Ensure that message sent timeout is called");      
    })
};

test['a message sent to a channel should NOT be sent to the unsubscribed agent.'] = function(beforeExit){
    var t = new newSMtest();
    var sm = t.sm, agent = t.agent, agent2 = t.agent2, n=0;
    
    sm.subscribe({name: "one exact"}, agent);
    sm.unsubscribe({name: "one exact"}, agent);
    
    sm.mq.publish("one exact", "PANTALONES!");
    
    setTimeout(function(){
      n++;
      assert.equal(agent.client.sentMessages.length, 0)
    }, 20)
    
    beforeExit(function(){
      assert.equal(1, n, "Ensure that message sent timeout is called");      
    })
};


test['unsubscribing the only agent should discontinue subscription'] = function(){
  var t = new newSMtest();
  var sm = t.sm, agent = t.agent, agent2 = t.agent2;

  sm.subscribe({name: "one exact"}, agent);
  var before_length = t.mqSubscriptions();
  sm.unsubscribe({name: "one exact"}, agent);
  
  assert.equal(t.mqSubscriptions(), 0);
};

test['unsubscribing a 1 + n agent should not discontinue mq subscription'] = function(){
  var t = new newSMtest();
  var sm = t.sm, agent = t.agent, agent2 = t.agent2;

  sm.subscribe({name: "one exact"}, agent);
  sm.subscribe({name: "one exact"}, agent2);
    
  sm.unsubscribe({name: "one exact"}, agent);
  assert.equal(t.mqSubscriptions(), 1);
};


module.exports = test;