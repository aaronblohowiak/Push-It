HOST = null; // localhost
PORT = 8001; //run it as root :-)
TIMEOUT = 30 * 1000; // 30 second timeout for open connections
FIREHOSE_SECRET_CHANNEL = "__firehose";
CHANNEL_CACHE_DURATION = 30 * 1000;
MEGABYTE = 1048576;
/* this is how many bytes are in a MB */
MAX_POST_SIZE = 0.5 * MEGABYTE; // this is a message bus, not a file server
//system requires
var sys = require("sys"),
	puts = sys.puts,
	events = require("events"),
	createServer = require("http").createServer,
	url = require("url"),
	querystring = require("querystring"),
	readFile = require("fs").readFile,
	net = require("net"),
	repl = require("repl");

//connect with telnet /tmp/node-repl-sock
net.createServer(function(socket) {
	repl.start("node via Unix socket> ", socket);
}).listen("/tmp/node-repl-sock");

//custom requires	
//this requires that you have my JavaScript-datastructures project in your $NODE_PATH
var ChannelHost = require("channel-host").ChannelHost;

//our main http connection handler
function cxn(request, response) {
	try {
		puts((new Date()).toString() + " " + "New connection: " + request.url);
		new HTTPConnection(request, response);
	} catch(err) {
		sys.puts(err);
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
			sys.puts('end received');
			try{
			  self.params || (self.params = {})
  			self.postBody = self.bodyChunks.join('');
        
        sys.puts("body: "+sys.inspect(querystring.parse(self.postBody)));
        sys.puts("body: "+sys.inspect(querystring.parse(self.postBody).getOwnProperties()));
        
  			self.route();			  
			}
			catch(err) {
    		sys.puts(err);
    	}
		});
	}
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
		var connection = this,
			path = connection.url_info.pathname;

		if (path in Routes) Routes[path](connection);
		else {
			//this is development static file serving.
			//do not use this for anything important.
			//use a cdn or a real file server for static assets, PLEASE!
			readFile(__dirname + '/' + path, function(err, data) {
				if (err) connection.notFound({});
				else connection.respond(200, data, "text/" + path.split('.').slice(-1));
			});
		}
	}
};

//Routes object is a path to handler map
Routes = {};

Routes["/"] = function(connection) {
	readFile(__dirname + '/index.html', 'utf8', function(err, data) {
		connection.respond(200, data, "text/html");
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
	session.connect(connection);
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
	try {
		if (connection.params && connection.params.session_id) {
			nodeSessions.destroy(connection.params.session_id);
		}
	} finally {
		connection.json({});
		return;
	}
};

Routes["/publish"] = function(connection) {
	var channel = connection.params.channel;
	data = connection.params.message;
	channelHost.publish(channel, data);
	connection.json({});
};

//stores the concept of the connection between the window and the channels.
//  handles physical connections closing and reopening
//  queues data for delivery to end user
function NodeSession(id, params, channels) {
	sys.puts(sys.inspect([id, params, channels]));

	this.session_id = id;
	this.creationParams = params;
	this.channels = channels;
	this.outboundQueue = [];
	this.connections = [];

	//this way receiveMessage is tightly bound to this NodeSession
	var self = this;
	this.receiveMessage = function(channel, data) {
		self.outboundQueue.push({
			channel: channel,
			data: data,
			timestamp: Date.now()
		});

		var connection;
		for (var i = self.connections.length - 1; i >= 0; i--) {
			try {
				connection = self.connections[i];
				connection.json(self.outboundQueue);
				clearTimeout(connection.timeout);
			} catch(e) {};
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
				connection.json([]);
			},
			TIMEOUT);
			connection.timeout = timeout;
		}
	},

	disconnect: function(connection) {
		var cxnIdx = this.connections.indexOf(connection);
		if (cxnIdx > -1) this.connections.splice(0, cxnIdx);
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

		sys.puts("creating session for " + session_id);

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
