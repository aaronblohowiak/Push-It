(function() {
	var last_message_timestamp = 0; //get from server.
	var session_id = Math.random();

	function initConnection() {
		var joinRequest = {
			session_id: session_id,
			location: window.location.href,
			channels: [window.location.href]
		};

		//once we have created this browser session, our tranport can start.
		$.post('/join', joinRequest, function() {
			waitForNewMessages();
		});
	};
	$(initConnection);

	//waitForNewMessages does the actual long-polling of the server
	//  and handles new messages when they are recieved
	function waitForNewMessages() {
		$.ajax({
			url: '/listen?since=' + last_message_timestamp + '&session_id=' + session_id,
			success: function(messages, textStatus, request) {
				if (messages && messages.length)
				  messagesRecieved(messages);
				  
				if (request.status == 200) 
				  waitForNewMessages();
				else
				  this.error(request, textStatus);  
				  
			},
			error: function(XMLHttpRequest, textStatus) {
				//TODO: throw event.
				setTimeout(waitForNewMessages, 10000);
			},
			type: "POST"
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
