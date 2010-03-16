# Push-It.js
## The real-time web doesn't have to break your brain!
### Summary:
What: Simple push server and client
Why: Developing real-time web applications shouldn't be complex
How: server:Node.js, client:jQuery
where: github.com/aaaronblohowiak/
  
### Overview

  This document introduces, justifies and explains the Many-To-Many JS project.  We begin with a brief history of browser-server interaction & implementation, , introduce Many-To-Many and describe the implementation.

### Let's review the evolution of browser-server interaction

1. Traditional web development revolves around the [request-response]("http://en.wikipedia.org/wiki/Request-response") model: the client (browser) makes a request to the server, and the server immediately responds with the resource.

  >When you load a web page in-browser, you watch the spinner and wait for your lovely page to appear.  While you're waiting, there's usually nothing you can do.
  
        <form action="/new">

2. With [AJAX]("http://en.wikipedia.org/wiki/Ajax_(programming)") we have the traditional request-response, but then we add in more requests *after the page has loaded* that will update the page in response to a user action.

  >When you vote on reddit, hn or whatnot, your vote is saved without reloading the page.

        $.post('/new');
        
3. With frequent [polling]("http://en.wikipedia.org/wiki/Polling_(computer_science)"), we continually ask the server if there is something new.

  >This stinks because of the lag between polls and the strain that each connection puts on the server
  
        function poll(){ since = (new Date).getTime(); $.get('/check?since='+since); }
        setTimeout(poll, delay);
        
4. With [Comet / BOSH / LongPolling]("http://en.wikipedia.org/wiki/Comet_(programming"), we perform an AJAX request and perform another immediately after the server finishes the response.  However, the server may take a long (240 seconds or more)