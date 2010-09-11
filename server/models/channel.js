var Channel = function(name, pushIt, onSubscriptionRequest, onPublicationRequest){
  this.name = name;
  this.pushIt = pushIt;
  this.onPublicationRequest = onPublicationRequest;
  this.onSubscriptionRequest = onSubscriptionRequest; 
}

Channel.prototype = {
  name: "/null",
  pushIt: null,
  onSubscriptionRequest: undefined,
  onPublicationRequest: undefined,

  subscribe: function(agent){
    this.pushIt.subscribe( this, agent);
  },
  
  publish: function(message){
    this.pushIt.publish( this, message);
  }
};

module.exports = Channel;