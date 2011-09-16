# Introduction
  
Push-It gives you an API for realtime pub/sub in the browser. On the server, it gives you hooks for security and message routing.  It is fast and cross-browser compatible.

## Dependencies

Self-contained on the client.  On the server, Push-It is tested with Node 0.4.7

# Overall Design
  The design takes the best of [bayeux](http://svn.cometd.com/trunk/bayeux/bayeux.html), layers it on top of [sockjs](https://github.com/majek/sockjs-client) and provides you a simple and clear way to define security for your application.

  With callbacks, you can easily customize the system to provide security and message-routing functionality.

  The system is designed with scaling in mind, so you will be able to run multiple Push-It servers without worrying about sticky sessions once sockjs supports pluggable persistence.  Please email aaron.blohowiak@gmail.com if this is something you require.
  
## Security
  You should override this: The default behavior of the system is to be completely open and echo all messages published to all subscribers on a per-channel basis.
  
  You define security at the point of connection, subscription and publication of messages.  The semantics are all asynchronous so you can call out from Node to other services to perform your security checking if you'd like.  For instance, you could check credentials with facebook connect, LDAP or a custom REST api. Each of these handlers has a timeout.  If your handler takes longer than its timeout, then the system will perform the least-permissive action (disconnecting a client, denying a subscription request or denying a publication.)

## Server and Client
  Push-It has the server that you run with node.js (or include in your existing node.js project,) and the client that you include in your web page.

# Client
      var channels = ["stories/5", "calendar"];
      var credentials = document.cookie; 
      pushIt = new PushIt({channels: channels, credentials: credentials});

      var msgId = pushIt.publish(message, onError, onSuccess);

      //set up message handler
      pushIt.onMessageReceived = function(channel, message){
         /* 
            update UI
            message has the properties: uuid, channel, and payload
         */
      };

      //unsubscribe
      pushIt.unsubscribe("messages");

      //subscribe to additional channels at runtime
      pushIt.subscribe("calendar/2", onError, onSuccess);
  
# Server
      //create your default server, raw http, connect or express
      var server = connect.createServer( 
        connect.staticProvider(__dirname + '/static')
      );

      //open your port
      server.listen(8001);

      //read the optional options file. sync is usually avoided, but fine for server statup
      var options = JSON.parse(fs.readFileSync(__dirname+"/options.json"))  

      //create the PushIt instance      
      var pi = new PushIt(server, options);

      //customize security gates. default is to permit all actions.
      pi.onConnectionRequest = function(agent){
        if(agent.credentials == "it's meeee!") //reasonable default ;)
          agent.connected();
      }
  
  
## Workflow
###1. An agent connects

      PushIt.onConnectionRequest = function(agent){}
  
  1. check the agent.credentials however you see fit.
  2. if they are valid, call agent.connected()
  3. if they are invalid or you have an error, call agent.connectionDenied(reason)
  4. if you do not call disconnect or connected, they will be denied after pushIt.TIMEOUTS.onConnectionRequest milliseconds

###2. An agent subscribes to channels

  The system will use the channel-specific function if the channel and function exist and will fall back to the default otherwise.
    
        PushIt.onSubscriptionRequest = function(channel, agent){}
        channel.onSubscriptionRequest = function(channel, agent){}

  1. check agent.credentials however you see fit
  2. if the agent is allowed to receive on this channel, call agent.subscribe(channel)
  3. if the agent is not allowed to receive on this channel,  call agent.subscriptionDenied(channel, reason)
  4. if you do not call subscribe or subscriptionDenied, they will be automatically disconnected after pushIt.TIMEOUTS.onSubscriptionRequest milliseconds
    
###3. An agent publishes to channels
  
  The system will use the channel-specific function if the channel and function exist and will fall back to the default otherwise.
    
        PushIt.onPublicationRequest = function(channel, agent, message){}
        channel.onPublicationRequest = function(channel, agent, message){}

  1. check agent.credentials however you see fit
  2. if the agent is allowed to publish on this channel, call channel.publish(message).  You may publish the message to as many channels as you'd like.
  3. call agent.publicationSuccess(message) if you have published the message (or dealt with it in some other way, like posting it to a rest service or logging it or whatever else you'd like,) 
  4. if the agent is not allowed to publish on this channel,  call agent.publicationDenied(message, reason)
  5. if you do not call agent.publicationDenied or agent.publicationSuccess, then a publicationDenied will be automatically sent  after pushIt.TIMEOUTS.onPublicationRequest milliseconds
  
###4. An message is sent to a channel where an agent has a subscription.
  
        Agent.onMessageReceived = function(channel, agent, message){}
  
  1. check agent.credentials however you see fit
  2. if the agent is allowed to receive this message, call agent.deliver(channel, message)

  NOTE: this callback is unlike the others.  there is no timeout or failure condition.  you can silently drop messages and nobody will be informed.  This is useful if you want to perform some JIT transformation of messages before delivery to agents.
  
###5. An agent unsubscribes to channels

  This is the same as subscription, except with the names changed to Unsubscribe and Unsubscription.
  
###6. An agent disconnects

    PushIt.onDisconnect(agent)
  
  This is provided for your convenience and completeness.

## Push-It Objects:

### Define in your code
  * PushIt
    * options
    * channels

  * Channel (a namespace for message distribution)
    * name
    * guards:
      * beforeJoin
      * onMessage

### created / destroyed at runtime
  * Agent (things that wish to be notified, and may stand in for other things of the same ilk)
    * uuid
    * isConnected
    * connection
    * credentials (application-defined)
  * Message (stuff to be routed)
    * uuid
    * channel (uuid)
    * data (application-defined)
  * Subscription (the connection between an agent and a channel)
    * uuid
    * channel (uuid)
    * agent (uuid)