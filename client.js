(function() {
	var last_message_timestamp = 0; //get from server.
	var session_id = Math.random();

	function initConnection() {
		
		var joinRequest = {
			session_id: session_id,
			location: window.location.href,
			channels: ['pizza', 'bbc']
		};

    window.console.log("calling JOIN!!!");
    
		$.get('/join', joinRequest, function() {
			waitForNewMessages();
		});
	};
  $(initConnection);
  
	//join the room with the chosen nickname
	$(document).delegate('#post', 'submit', function(event) {
		event.preventDefault();

		var chan = $('#post .channel'),
			channel = chan.val();
    chan.val('');
      
    var msg = $('#post .message'),
			message = msg.val();
    msg.val('');
    
		if (message.length){
		  $.get('/publish', {
		    channel: channel,
  			message: message,
  			session_id: session_id //todo: handle this on the protocol layer
  		}); 
		}else{
		  alert("type something for a message before you send!");
		}

		return false;
	});

	//waitForNewMessages does the actual long-polling of the server
	//  and handles new messages when they are recieved
	function waitForNewMessages() {
		$.ajax({
			url: '/listen?since=' + last_message_timestamp+'&session_id='+session_id,
			success: function(messages, textStatus, request) {
				if (request.status !== 200) this.error(request, textStatus);
				else {
					if (messages && messages.length) messagesRecieved(messages);

					waitForNewMessages();
				}
			},
			error: function(XMLHttpRequest, textStatus) {
				messagesRecieved([{
					timestamp: (new Date).getTime(),
					type: 'error',
					data: textStatus + ' code recieved from server'
				}]);
				setTimeout(waitForNewMessages, 10000);
			}
		});
	}

	function messagesRecieved(messages) {
		for (var i = 0; i < messages.length; i++) {
		  window.console.log(messages[i]);
			last_message_timestamp = messages[i].timestamp;
			var date = new Date(messages[i].timestamp),
				msg = messages[i].data;
		}
	};

	//if we can, notify the server that we're going away.
	$(window).unload(function() {
		jQuery.get("/leave", {
			session_id: session_id
		},
		function(data) {},
		"json");
	});

})();
