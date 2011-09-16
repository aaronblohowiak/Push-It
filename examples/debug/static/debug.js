$(function() {
  
  function onError(data){
    console.log("ERROR!");
    console.log(data);
  }
  
  function onSuccess(data){
    console.log("SUCCESS CONFIRMATION RECEIVED");
    console.log(data);
  }
  
	window.pushIt = new PushIt({
		channels: []
	});

	$(document).delegate('#post', 'submit', function(event) {
		event.preventDefault();

		var channel = $('#post .channel').val();
		var message = $('#post .message').val();
		$('#post .channel, #post .message').val('');

		if (message.length) {
			window.pushIt.publish({
				channel: channel,
				data: message
			}, onError, onSuccess);
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
	 var li = $('<li/>');
	 li.append('<span class="channel">'+message.channel+'</span> ');

	 li.append('<span class="timestamp">'+(new Date().toString())+'</span>');
	 li.append('<pre class="data">'+JSON.stringify(message)+'</pre>');
	 $('#messages').prepend(li);
	};

});
