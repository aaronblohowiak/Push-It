HOST = null; // localhost
PORT = 8001; //run it as root :-)
TIMEOUT = 30 * 1000; // 30 second timeout for open connections
CHANNEL_CACHE_DURATION = 30 * 1000;

/* this is how many bytes are in a MB */
MEGABYTE = 1048576;
MAX_POST_SIZE = 0.5 * MEGABYTE; // this is a message bus, not a file server

FIREHOSE_SECRET_CHANNEL = "__firehose";

//system requires
var sys = require("sys"),
	puts = sys.puts,
	events = require("events"),
	createServer = require("http").createServer,
	url = require("url"),
	querystring = require("querystring"),
	readFile = require("fs").readFile,
	net = require("net");

//custom requires	
//this requires that you have my JavaScript-datastructures project in your $NODE_PATH
var ChannelHost = require("./lib/channel-host").ChannelHost;

//our main http connection handler
function cxn(request, response) {
	try {
		puts((new Date()).toString() + " " + "New connection: " + request.url);
		new HTTPConnection(request, response);
	} catch(err) {
		sys.puts(err + err.trace);
	}
}

server = createServer(cxn);
server.listen(PORT, HOST);
sys.puts("Server at http://" + (HOST || "127.0.0.1") + ":" + PORT + "/");

//TODO: replace this with expriring collection with an onExpire handler.
//This is the function that gets called on every new connection to the server
//  we ensure the constructor call (new HTTPConnection) so we can use the new scope
//  does some up-front processing of request params 
//  then finally, routes the connection to the appropriate handler
function HTTPConnection(request, response) {
	if (! (this instanceof HTTPConnection)) return new HTTPConnection(request, response);

	this.req = request;
	this.res = response;
	this.url_info = url.parse(this.req.url, true);
	this.path = this.url_info.pathname.replace(Routes.mount, '');	 
	this.params = this.url_info.query;
	this.timestamp = (new Date()).getTime();
	this.bodyChunks = [];
	var self = this;

	//Cache whole post body in memory before doing anything
	if (request.method == "GET") {
		this.route();
	} else {
		if (parseInt(request.headers['content-length'], 10) > MAX_POST_SIZE) {
			self.json({
				error: "content-length too big"
			},
			413);
		};

		request.addListener('data', function(chunk) {
			self.bodyChunks.push(chunk);
		});

		request.addListener('end', function() {
			try{
			  self.params || (self.params = {});
  			self.postBody = self.bodyChunks.join('');      
        self.post_params = querystring.parse(self.postBody);
        sys.puts("body: "+sys.inspect(self.post_params));
        
        for(var param in self.post_params){
          self.params[param] || ( self.params[param] = self.post_params[param]);
        }
  			self.route();			  
			}
			catch(err) {
    		sys.puts(err+" "+err.trace);
    	}
		});
	}
	
	return this;
};

//The prototype of all connections contains convienence functions for responding
//  respond is fully-parameterized "write data and close", most others call it
//  json stringifies the object with a default http status code of 200
//  notFound gives a simple 404
//  route passes a connection to a handler if one is registered for that path
//    if the path is unregistered, it attempts to read a file from disk
//    if there is an error reading file from disk, returns 404
HTTPConnection.prototype = {
	respond: function(status, body, type) {
		var header = [
			["Content-Type", type],
			["Content-Length", body.length]];
		this.res.writeHead(status, header);
		this.res.write(body);
		this.res.end();
	},

	json: function(obj, code) {
		obj || (obj = {});
		code || (code = 200);
		obj.timestamp || (obj.timestamp = (new Date()).getTime());
		this.respond(code, JSON.stringify(obj), "application/json");
	},

	notFound: function() {
		this.respond(404, "Not Found", 'text/plain');
	},

	route: function() {
	  Routes.route(this);
	}
};

//Routes object is a path to handler map
Routes = {};

Routes.mount = new RegExp(/^\/push-it/);
Routes.static_prefix = __dirname + '/example/';

Routes.route = function(connection) {
 	var path = connection.path;

	if (path in Routes) Routes[path](connection);
	else Routes.missing(connection); 
};

Routes.missing = function(connection) {
	//this is development static file serving.
	//do not use this for anything important.
	//use a cdn or a real file server for static assets, PLEASE!
	var path = connection.path;
	sys.puts("trying to load static file: "+ __dirname + '/' + path);
	if(path.charAt(path.length - 1) == "/"){
	  path = path + "index.html";
	}
	
	readFile(this.static_prefix + path, function(err, data) {
		if (err) connection.notFound({});
		else connection.respond(200, data, "text/" + path.split('.').slice(-1));
	});	
};

Routes["/"] = function(connection) {
	readFile(__dirname + '/example/debug/index.html', 'utf8', function(err, data) {
	  if (err){
	    sys.puts("checking for static file: "+ __dirname + '/example/debug/index.html');
	    connection.notFound({});
	  } 
	  else connection.respond(200, data, "text/html");
	});
};

//endpoint for clients awaiting updates
//  returns messages created since the since query param
Routes["/listen"] = function(connection) {
	// var since = parseInt(connection.params.since || 0, 10),
	//  messages = channel.messagesSince(since);
	// if (messages.length > 0) connection.json(messages);
	// else 
	var session = nodeSessions.sessions[connection.params.session_id];
	if(session){
	  session.connect(connection);
	}else{
	  connection.json({error: "Session Not found"}, 404);
  }
};

//endpoint for clients that want to join or "log in"
//  expects session_id query param
//  joins the default channel
//  returns the resulting session object
Routes["/join"] = function(connection) {
	var session = nodeSessions.create(connection.params.session_id, connection.params, connection);

	//this is where some magic will happen!
	//  set up subscriptions here!
	connection.json(session);
};

//endpoint for clients that are leaving
//  expects a session_id query param
//  announces exit to room
//  closes connection without response
Routes["/leave"] = function(connection) {
  connection.json({});
	
	try {
		if (connection.params && connection.params.session_id) {
			nodeSessions.destroy(connection.params.session_id);
		}
	}catch(e){}
};

Routes["/publish"] = function(connection) {
	var channel = connection.params.channel;
	data = connection.params.message;
	channelHost.publish(channel, data);
	connection.json({});
};

Routes["/subscribe"] = function(connection) {
	var channel = connection.params.channel;
	var session = nodeSessions.sessions[connection.params.session_id];
	if(session){
	  sys.puts(channel);
	  session.subscribe(channel);
	  connection.json(session.channels);
	}else{
	  connection.json([]);
	}
};


//stores the concept of the connection between the window and the channels.
//  handles physical connections closing and reopening
//  queues data for delivery to end user
function NodeSession(id, params, channels) {
	this.session_id = id;
	this.creationParams = params;
	this.channels = channels;
	this.outboundQueue = [];
	this.connections = [];

	//this way receiveMessage is tightly bound to this NodeSession
	var self = this;
	this.receiveMessage = function(channel, message) {
	  message.channel = channel;
		self.outboundQueue.push(message);

		var connection;
		for (var i = self.connections.length - 1; i >= 0; i--) {
			try {
				connection = self.connections[i];
				connection.json({messages: self.outboundQueue, timestamp: Date.now()});
				clearTimeout(connection.timeout);
			} catch(err) {
      		sys.puts(err+" "+err.trace);
      	};
		};

		self.connections = [];
		self.outboundQueue = [];
	};

	return this;
};

NodeSession.prototype = {
	connect: function(connection) {
		if (this.outboundQueue.length) {
			connection.json(self.outboundQueue);
			self.outboundQueue = [];
		} else {
			//TODO: get rid of this global function
			this.connections.push(connection);
			var self = this;
			var timeout = setTimeout(function() {
				self.disconnect(connection);
				connection.json({timestamp: Date.now});
			},
			TIMEOUT);
			connection.timeout = timeout;
		}
	},

	disconnect: function(connection) {
		var cxnIdx = this.connections.indexOf(connection);
		if (cxnIdx > -1) this.connections.splice(0, cxnIdx);
	},
	
	subscribe: function(channel){
	  if(this.channels.indexOf(channel) > -1)
	    this.channels.push(channel);
	    channelHost.observe(channel, this.receiveMessage);
			
	},
	
	ignore: function(channel){
	  var idx = this.channels.indexOf(channel);
	  if(idx > -1){
	    this.channels.splice(idx, 1);
	  }
	}
};

//stores the browser window sessions
var Clients = function() {
	this.sessions = {};
};

Clients.prototype = {
	create: function(session_id, params, connection) {
		var subscriptions = params.channels || [];
		var firehoseIdx = subscriptions.indexOf("__firehose");
		var firehose = false;

		if (firehoseIdx > -1) {
			subscriptions.splice(firehoseIdx, 1);
			firehose = true;
		}

		//now, make the subscriptions
		var session = new NodeSession(session_id, params, subscriptions);
		this.sessions[session_id] = session;

		//activate subscriptions
		for (var i = subscriptions.length - 1; i >= 0; i--) {
			channelHost.observe(subscriptions[i], session.receiveMessage);
		};

		if (firehose) {
			channelHost.firehose(session.receiveMessage);
		}
		return session;
	},

	destroy: function(session_id) {
		sys.puts("destroying: " + session_id);
		delete this.sessions[session_id];
	}
};

nodeSessions = new Clients();
channelHost = new ChannelHost(CHANNEL_CACHE_DURATION);
