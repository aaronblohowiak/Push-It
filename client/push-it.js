//adds a PushIt(options); function 
(function(global) {
	function PushIt(options) {
		var self = this;
		this.last_message_timestamp = 0; //get from server.
		this.messageCallbacks = {};
		this.agentId = this.uuid(22, 64);

		this.channels = [window.location.href];
		if (options.channels) {
			this.channels = this.channels.concat(options.channels);
		}

		$(function() {
			self.initConnection();
		});

	};

	PushIt.prototype = {
		initConnection: function() {
			var self = this;

			var joinRequest = {
        data: { credentials: "it is meeeee" },
				channel: "/meta/connect"
			};

			io.setPath('/push-it/lib/socket.io/');
      socket = new io.Socket('localhost');
      this.socket = socket;
      socket.connect();
      this.sendMessage(joinRequest);
      socket.addEvent('message', function(data){
          self.onMessageReceived(data);
      });
      
		},

		onMessageReceived: function(message) {
		  console.log(message);
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

      this.sendMessage({
          "data": data.message,
          "channel": data.channel
        });
		},
		
		sendMessage: function(obj, onError, onSuccess){
		  //eventually, add in credentials / connection id.
		  obj.uuid = this.UUID(22, 64);
		  obj.agentId = this.agentId;
		  this.messageCallbacks[obj.id] = {onError: onError, onSuccess: onSuccess};
		  this.socket.send(obj);
		  return obj;
		},
		

    UUID: function(len, radix) {
  		var BASE64CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split(''); 
      /*!
      Math.uuid.js (v1.4)
      http://www.broofa.com
      mailto:robert@broofa.com

      Copyright (c) 2010 Robert Kieffer
      Dual licensed under the MIT and GPL licenses.
      */

      var chars = BASE64CHARS, uuid = [], i=0;
      radix = radix || chars.length;

      if (len) {
        // Compact form
        for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
      } else {
        // rfc4122, version 4 form
        var r;

        // rfc4122 requires these characters
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';

        // Fill in random data.  At i==19 set the high bits of clock sequence as
        // per rfc4122, sec. 4.1.5
        for (i = 0; i < 36; i++) {
          if (!uuid[i]) {
            r = 0 | Math.random()*16;
            uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
          }
        }
      }

      return uuid.join('');
    }
    
	};

	global.PushIt = PushIt;
})(this);



 
  