# Push-It [Status: Pre-Alpha]
This project is not yet ready for use, even by bleeding-edge hardcore devs ;)
## Make your web-app Real-Time.  Comet for Ruby on Rails, Django and PHP
Polling is terrible and uses lots of server resources.  You should be using push instead.  Make one push from your application to Push-It, and Push-It sends your data out to all the web browsers.
### Summary:
What: Simple push server / comet server and client  
Why: Developing real-time web applications shouldn't be complex  
How: Node.JS server, jQuery client  
Where: [http://github.com/aaronblohowiak/Push-It](http://github.com/aaronblohowiak/Push-It)  
Who: [Aaron Blohowiak](mailto:aaron.blohowiak@gmail.com)
  
## Introduction 
### Overview
  Push-It lets you add push notifications to your existing web app *very* easily.
  
  There are two parts: the server, and the client.
  
  The client depends on jQuery (tested with 1.4.2)
  The server depends on Node.JS (tested with 0.1.95)
  
  The client "joins" the server with a list of streams that it would like to subscribe to with a POST.
  Then, it opens a virtually persistent connection to the server. (It is actually long-polling, but that is an implementation detail, and WebSocket support will be added soon.)
  The server starts sending your client any new data on the streams that it is subscribed to.
  The client has a callback (messagesReceived) that gets an array of objects that have the channel name, the data and a unix timestamp.
  
  That's it!
  
  Oh yea, how do you create new event?
  
  Presently, anybody can add data to any channel with a simple REST call.
  This could be browsers, it could be your app server, go nuts.
  
  There is not currently any concept of a "User", only a browser-window and its connection.
  
### Example

Client:
    
    var channels = ["stories/5", "calendar"];
    pushIt = PushIt({prefix: '/push-it/', channels: channels});
    
    //set up message handler
    pushIt.messageReceived = function(message){
       /* 
          update UI 
          message has the properties: channel, timestamp and data
       */
    };
    
    //unsubscribe
    pushIt.ignore("messages");
    
    //subscribe to additional channels at runtime
    pushIt.subscribe("calendar/2");
    
    
App Server:
    
    #publish comment updates to 
    class CommentObserver < ActiveRecord::Observer
      def after_create(comment)
        PushIt.publish!(
          :channels => publish_channels(comment),
          :payload => comment.to_json
        )
      end
      
      def on_update(comment)
        PushIt.publish!(
          :channels => publish_channels(comment),
          :payload => comment.to_json
        )
      end
      
      def publish_channels(comment)
        #notify anyone viewing this resource's parent
        channels = ["stories/#{story_id}"]
      
        #add to most recent comment feed
        channels << "comments/latest"
        
        #add to author's comment feed
        channels << "/users/#{comment.user.id}/comments"
      end
    end

        
## Justification
### Let's review the evolution of browser-server interaction

1. Traditional web development revolves around the [request-response]("http://en.wikipedia.org/wiki/Request-response") model: the client (browser) makes a request to the server, waits for a response, the server sends the resource, the connection closes and the browser renders the page.  
  >When you load a web page in-browser, you watch the spinner and wait for your lovely page to appear.  While you're waiting, there's usually nothing you can do.
  
        <form action="/new">

2. With [AJAX]("http://en.wikipedia.org/wiki/Ajax_(programming)") we have the traditional request-response, but then we add in more requests *after the page has loaded* that will update the page in response to a user action.  
  >When you vote on reddit, hn or whatnot, your vote is saved without reloading the page.


        $.post('/new');
      
3. With frequent [polling]("http://en.wikipedia.org/wiki/Polling_(computer_science)"), we make ajax requests at set intervals and update the page with any new content or changes.  
  >This stinks because of the lag between polls and the strain that each connection puts on the server
  

        var since = 0; 
        function UpdateSince(){ since = (new Date).getTime(); };
        function Poll(){ $.get('/check?since='+since, ProcessResults); };
        function ProcessResults(data){ UpdateSince(); UpdatePage(data); };
        setTimeout(Poll, delay);
  
4. With [Comet / BOSH / LongPolling]("http://en.wikipedia.org/wiki/Comet_(programming"), we make a regular AJAX request, but the server waits until it has data to send before replying to the request.  The browser initiates another request immediately upon response.  
  >New facebook chat messages just "show up" right in your browser, without having to click anything.. your browser just uses one connection at a time.
  

        var since = 0; 
        function UpdateSince(){ since = (new Date).getTime(); };
        function LongPoll(){ $.get('/check?since='+since, ProcessResults); };
        function ProcessResults(data){ 
          UpdateSince(data); 
          UpdatePage(data); 
          LongPoll();
        };

## Implementation

The browser makes an AJAX request and the server returns immediately with any updates, just like polling.  *However*, if the server _doesn't_ have any updates, things get funky.  Instead of responding immediately, the server takes waits before getting back to the client.  The server can wait up to around 240 seconds to have something to send to the browser as the response for the request.  When the server has data to return, it responds with the data.  To the AJAX client, it just seems like a request that took a really long time. Because we don't know how long the request-response cycle is going to take, we fire off the next poll in the response handler.  Because we make a new request as soon as we get a response it seems like the client is maintaining an open connection to the server, as it almost always has one open, ready and waiting.