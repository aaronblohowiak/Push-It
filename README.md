# Push-It.js
## The real-time web doesn't have to break your brain!
### Summary:
What: Simple push server / comet server and client  
Why: Developing real-time web applications shouldn't be complex  
How: Node.js server, jQuery client  
Where: [http://github.com/aaronblohowiak/Push-It](http://github.com/aaronblohowiak/Push-It)  
Who: [Aaron Blohowiak](mailto:aaron.blohowiak@gmail.com)
  
## Introduction 
### Overview
  This document introduces, justifies and explains the Push-It.js project.  We begin with a brief history of browser-server interaction & implementation, discuss existing solutions, introduce Push-It.js and describe the implementation.

### Example

####default-conf.json
  
    {
      "server":{
        "port": 8001
      },
      
      "user_channel":{
        "session_key": "session_id",
        "cache_prefix": "sessions_users/",
        "user_channel_prefix": "user/"
      },

      "shared_cache": {
        "type":"memcached",
        "host":"localhost",
        "port":"11211"
      }
    }
    
App Server:

    # ensure the session id is in a simple cookie
    # ensure the real user id is in memcached
  
    #let a user know they have a new message
    class MessageObserver < ActiveRecord::Observer      
      def after_create(message)
        PushIt.publish!(
          :channels => ["user/#{recipient_id}"],
          :payload => message.to_json,
          :type => "Message"
        )
      end
    end
    
    #publish comment updates to 
    class CommentObserver < ActiveRecord::Observer
      def after_create(comment)
        PushIt.publish!(
          :channels => publish_channels,
          :payload => comment.to_json,
          :type => "Comment"
        )
      end
      
      def on_update(comment)
        PushIt.publish!(
          :channels => publish_channels,
          :payload => comment.to_json,
          :type => "Comment"
        )
      end
      
      def publish_channels
        #notify anyone viewing this resource's parent
        channels = ["story/#{story_id}"]
      
        #add to most recent comment feed
        channels << "comment/latest"
      
        #notify the author of the parent comment if it exists
        channels << "user/#{parent.poster_id}" if parent
      end
    end
    

Client:
    Handlers = {
      "Messages" : {
        "new" : function(channel, message){
          
        }
      }
    }
    
    var session_id = $.cookie('session_id');
    var channels = [window.location.pathname]; //user channel is auto-magic
    var endpoint = '/subscribe'
    Subscribe(endpoint, {session_id: session_id, channels: channels});

        
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