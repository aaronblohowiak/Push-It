var test = {},
    MQ = require('in_memory'),
    assert = require('assert');;
    
module.exports = test;

test["a subscription without a * at the end should be considered exact"] = function(){
  var mq = new MQ;
  mq.subscribe("name", function(){});
  assert.isDefined(mq.exactSubscriptions["name"]);
};

test["a subscription with a * at the end should be considered wildcard"] = function(){
  var mq = new MQ;
  mq.subscribe("name*", function(){});
  assert.isDefined(mq.wildcardSubscriptions["name"]);
};

test["ensure unsubscribing for wildcards works as well"] = function(){
  var mq = new MQ;
  mq.subscribe("name*", function(){});
  assert.isDefined(mq.wildcardSubscriptions["name"]);
  mq.unsubscribe("name*");
  assert.isUndefined(mq.wildcardSubscriptions["name"]);
};


test["subscribe to a channel glob to get messages matching your prefix"] = function(beforeExit){
  var mq = new MQ;
  var received = 0, n=0;
  
  mq.subscribe("name*", function(){ received++; });
  mq.publish("namekins", "PANTALONES!");
  
  setTimeout(function(){
    n++;
    assert.equal(received, 1);
  }, 20);
  
  beforeExit(function(){
    assert.equal(1, n, "Ensure that glob channel message sent timeout is called");      
  });
};
