//adds a PushIt(options); function 
(function(global) {
	function PushIt(options) {
		self = this;
		this.last_message_timestamp = 0; //get from server.
		this.session_id = Math.random();
		this.prefix = options.prefix;
		this.prefix || (this.prefix = '');

		//if we can, notify the server that we're going away.
		$(window).unload(function() {
			jQuery.get(this.prefix + "/leave", {
				session_id: this.session_id
			},
			function(data) {},
			"json");
		});

		$(function() {
			self.initConnection();
		});

	};

	PushIt.prototype = {
		initConnection: function() {
			console.log("init connection");

			var joinRequest = {
				session_id: this.session_id,
				location: window.location.href,
				channels: [window.location.href]
			};

			//once we have created this browser session, our tranport can start.
			$.post(this.prefix + '/join', joinRequest, function() {
				waitForNewMessages();
			});
		},

		//waitForNewMessages does the actual long-polling of the server
		//  and handles new messages when they are recieved
		waitForNewMessages: function() {
			self = this;
			$.ajax({
				url: this.prefix + '/listen?since=' + this.last_message_timestamp + '&session_id=' + this.session_id,
				success: function(messages, textStatus, request) {
					if (messages && messages.length) messagesRecieved(messages);

					if (request.status == 200) waitForNewMessages();
					else this.error(request, textStatus);

				},
				error: function(XMLHttpRequest, textStatus) {
					//TODO: throw event.
					setTimeout(self.waitForNewMessages, 10000);
				},
				type: "POST"
			});
		},

		messagesRecieved: function(messages) {
			for (var i = 0; i < messages.length; i++) {
				window.console.log(messages[i]);
				this.last_message_timestamp = messages[i].timestamp;
				var date = new Date(messages[i].timestamp),
					msg = messages[i].data;
			}
		}
	};

	global.PushIt = PushIt;
})(this);
