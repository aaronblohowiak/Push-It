//adds a PushIt(options); function 
(function(global) {
	function PushIt(options) {
		var self = this;
		this.last_message_timestamp = 0; //get from server.
		this.messageCallbacks = {};
		this.agentId = this.UUID(22, 64);

		this.channels = [window.location.href];
		if (options.channels) {
			this.channels = this.channels.concat(options.channels);
		}

		$(function() {
			self.initConnection(options);
		});

	};

	PushIt.prototype = {
		initConnection: function(options) {
			var self = this;

			var joinRequest = {
        data: { credentials: "it is meeeee" },
				channel: "/meta/connect"
			};

      if(!options.hostname){
        alert("You must pass a hostname to initialize Push-It");
      }
      
      socket = new io.Socket(options.hostname);
      this.socket = socket;
      socket.connect();
      
      this.sendMessage(joinRequest);
      
      socket.addEvent('message', function(message){
        var chan = message.channel;
        switch(chan){
          case '/meta/succesful':
            self.messageCallbacks[message.uuid].onSuccess();
            break;
          case '/meta/error':
            self.messageCallbacks[message.uuid].onSuccess();
            break;
          default:
            console.log(message);
            self.onMessageReceived(message);
        }
      });
      
		},

		onMessageReceived: function(message) {
		  console.log("message: ", message);
			console.error("you must define an onMessageReceived callback!");
		},

    subscribe: function(channel, onError, onSuccess) {
			this.sendMessage({
			  "channel": "/meta/subscribe",
			  "data": {
			    "channel": channel
			  }
			});
    },
    
    unsubscribe: function(channel) {
			this.sendMessage({
			  "channel": "/meta/unsubscribe",
			  "data": {
			    "channel": channel
			  }
			});
    },
    
		publish: function(data, onError, onSuccess) {
			//			console.log("PUBLISHING");
			if (!data.hasOwnProperty("channel") || !data.hasOwnProperty("message")) {
				console.log("error: the object sent to publish must have channel and message properties");
				return;
			}
			
			onError || (onError = function(){});
			onSuccess || (onSuccess = function(){});

      var sent = this.sendMessage({
          "data": data.message,
          "channel": data.channel
        }, onError, onSuccess);
		},
		
		sendMessage: function(obj, errorHandler, successHandler){
		  obj.uuid = this.UUID(22, 64);
		  obj.agentId = this.agentId;
		  if( errorHandler || successHandler){
		    this.messageCallbacks[obj.uuid] = {onError: errorHandler, onSuccess: successHandler};		    
		  }
		 
		  this.socket.send(obj);
		  return obj;
		},
		

    UUID: function(len, radix) {
  		var BASE64CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''); 
      var chars = BASE64CHARS, uuid = [], i=0;
      radix = radix || chars.length;
      len = len || 22;

      for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];

      return uuid.join('');
    }
	};

	global.PushIt = PushIt;
})(this);
