$(function() {
	window.pushIt = new PushIt({
		prefix: "/push-it",
		channels: [],
		hostname: document.domain
	});

	$(document).delegate('#post', 'submit', function(event) {
		event.preventDefault();

		var channel = $('#post .channel').val();
		var message = $('#post .message').val();
		$('#post .channel, #post .message').val('');

		if (message.length) {
			window.pushIt.publish({
				channel: channel,
				message: message
			});
		}

		return false;
	});
	
	
	$(document).delegate('#subscribe', 'submit', function(event) {
		event.preventDefault();

		var channel = $('#subscribe .channel').val();
		$('#subscribe .channel').val('');

    window.console.log("channel: "+channel);
		if (channel.length) {
			window.pushIt.subscribe(channel);
		}

		return false;
	});
	
	pushIt.onMessageReceived = function(message){
	 console.log("aaaah", message)
	 var li = $('<li/>');
	 li.append('<span class="channel">'+message.channel+'</span> ');

	 li.append('<span class="timestamp">'+(new Date().toString())+'</span>');
	 li.append('<pre class="data">'+JSON.stringify(message)+'</pre>');
	 $('#messages').prepend(li);
	};

});
