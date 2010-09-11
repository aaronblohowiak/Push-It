sys = require('sys')
// the simplest message queue is in-memory.
// here, we model a common interface for all of the message queues that Push-It supports.

var InMemoryMQ = function(){
  this.exactSubscriptions = {};
  this.wildcardSubscriptions = {};
};

var proto = {};
InMemoryMQ.prototype = proto;

//the callback is trigger on a new message receipt
// there should probably be an error/success handler as well
proto.subscribe = function(chan, callback){
  var obj = { callback: callback };
  var len = chan.length;
  if(chan.substr(len - 1, 1) == "*"){
    obj.chan = chan.substr(0, len - 1 );
    obj.len = obj.chan.length;
    this.wildcardSubscriptions[obj.chan] = obj;
  }else{
    obj.chan = chan;
    obj.len = len;
    this.exactSubscriptions[obj.chan] = obj;
  }
};

//Assume success.
proto.unsubscribe = function(chan){
  var len = chan.length;
  if(chan.substr(len - 1, 1) == "*"){
    chan = chan.substr(0, len - 1 );
    delete this.wildcardSubscriptions[chan];
  }else{
    delete this.exactSubscriptions[chan];
  } 
};

//This takes a chan name, not a Channel object
//There should probably be a callback of some variety for error/success
proto.publish = function(chan, message){
  var self = this;
  var subscriber = this.exactSubscriptions[chan];
  if(subscriber){
    process.nextTick(function(){
      subscriber.callback(message);      
    });
  }
  
  var sub = {};
  var len = chan.length;
  for(var pattern in this.wildcardSubscriptions){
    sub = this.wildcardSubscriptions[pattern];
    if(sub && len >= sub.len && chan.substr(0, sub.len) == sub.chan){
      process.nextTick(function(){
        sub.callback(message);
      });
    }
  }
};

module.exports = InMemoryMQ;
