var inspect = require('sys').inspect;

//TODO: implement save / pluggable persistence layers

var agents = {};

function Agent(obj){
    if(!(this instanceof Agent)) return new Agent(obj);
    
    this.id = obj.id;
    agents[obj.id] = this; // auto-save. TODO: garbage collect
    this.credentials = obj.credentials;
    this.isConnected = obj.isConnected;
    this.client = obj.client;
    
};

var agent = Agent;

agent.agents = agents;

agent.get = function(id, callback){
  callback(null, agents[id]);
};

agent.prototype.send = function(msg){
  if(this.client){
    this.client.send(msg); //for now.  
  }
};

agent.prototype.connected = function(){
  clearTimeout(this.authenticationTimeout);
  this.isConnected = true;
  
  this.send({
    "channel":"/meta/connect",
    "successful": true,
    "agentId":this.id,
    "error": ""
  });
};

agent.prototype.connectionDenied = function(reason){
  clearTimeout(this.authenticationTimeout);
  this.send({
    "channel":"/meta/connect",
    "agentId":this.id,
    "successful": false,
    "error": reason
  }); 
};

agent.prototype.requireConnection = function(timeout){
  var self = this;
  this.authenticationTimeout = setTimeout(function(){
      self.connectionDenied("Time expired before authentication could be established.");
    }, timeout);
};


agent.prototype.subscribe = function(channel){
  this.subscriptionResponse(channel, true);
  channel.subscribe(this);
};

agent.prototype.subscriptionDenied = function(channel, reason){
  this.subscriptionResponse(channel, false, reason);
};

agent.prototype.subscriptionResponse = function(channel, successful, error){
  error || (error = "");

  if(typeof(channel) == "string"){
    name = channel;
  }else{
    name = channel.name;
  }
  
  var request = this.subscriptionRequests[name];
  var message = request.message;
  clearTimeout(request.timeout);
  
  message.successful = successful;
  message.error = error;
  this.send(message);
};

agent.prototype.requirePublication = function(timeout, message, channel){
  var self = this;
  
  var name = message.uuid;
  this.publicationRequests || (this.publicationRequests = {});

  var request = {};
  request.message = message;
  
  request.timeout = setTimeout(function(){
    self.publicationDenied(message, "Time expired before publication authorization could be established.");
  }, timeout);
  
  this.publicationRequests[name] = request;
};


agent.prototype.publicationSuccess = function(message){
  this.publicationResponse(message, true);
};

agent.prototype.publicationDenied = function(message, reason){
  this.publicationResponse(message, false, reason);
};

agent.prototype.publicationResponse = function(message, successful, error){
  error || (error = "");
  
  var request = this.publicationRequests[message.uuid];
  var newMessage={};
  
  clearTimeout(request.timeout);
  //perhaps i should also delete the publicationRequest!
  
  if(successful){
    newMessage.channel="/meta/successful";
  }else{
    newMessage.channel="/meta/error";
    newMessage.error = error;
  }
  newMessage.uuid = message.uuid;
   
  this.send(newMessage);
};

agent.prototype.requireSubscription = function(timeout, message, channel){
  var self = this;
  
  var name = channel.name;
  this.subscriptionRequests || (this.subscriptionRequests = {});

  var request = {};
  request.message = message;
  
  request.timeout = setTimeout(function(){
    self.subscriptionDenied(channel, "Time expired before subscription authorization could be established.");
  }, timeout);
  
  this.subscriptionRequests[name] = request;
};

module.exports = Agent;
