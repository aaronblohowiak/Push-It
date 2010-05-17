HOST = null; // localhost
PORT = 8001; //run it as root :-)
TIMEOUT = 30 * 1000; // 30 second timeout for open connections
CHANNEL_CACHE_DURATION = 30 * 1000;

var sys = require("sys"),
	puts = sys.puts,
	events = require("events"),
	createServer = require("http").createServer,
	url = require("url"),
	readFile = require("fs").readFile,
	net = require("net"),
  repl = require("repl");;

net.createServer(function (socket) {
  repl.start("node via Unix socket> ", socket);
}).listen("/tmp/node-repl-sock");

var ChannelHost = require("channel-host").ChannelHost;

server = createServer(Connection);
server.listen(PORT, HOST);
sys.puts("Server at http://" + (HOST || "127.0.0.1") + ":" + PORT + "/");

//long_connections is a queue of the clients awaiting some event
server.long_connections = [];

//however, we have to close the connections even if no event happens
//  because some proxies don't do well with long-open connections
//  so, iterate over the server's long_connections and return an empty array
//  of notifications to the to-be-closed connections
function respondToStaleConnections() {
	if (server.long_connections.length) {
		now = (new Date).getTime();
		while ((server.long_connections[0].timestamp + TIMEOUT) < now) {
			server.long_connections.shift().json([]);
			if (! (server.long_connections.length)) break;
		}
	}
	setTimeout(respondToStaleConnections, 1000);
}

respondToStaleConnections();
//TODO: replace this with expriring collection with an onExpire handler.

//This is the function that gets called on every new connection to the server
//  we ensure the constructor call (new Connection) so we can use the new scope
//  does some up-front processing of request params 
//  then finally, routes the connection to the appropriate handler
function Connection(request, response) {
	if (! (this instanceof Connection)) return new Connection(request, response);

	this.req = request;
	this.res = response;
	this.url_info = url.parse(this.req.url, true);
	this.params = this.url_info.query;
	this.timestamp = (new Date()).getTime();

	puts((new Date()).toString() + " " + "New connection: " + this.url_info.pathname);

	this.route();
	return false;
};

//The prototype of all connections contains convienence functions for responding
//  respond is fully-parameterized "write data and close", most others call it
//  json stringifies the object with a default http status code of 200
//  notFound gives a simple 404
//  route passes a connection to a handler if one is registered for that path
//    if the path is unregistered, it attempts to read a file from disk
//    if there is an error reading file from disk, returns 404
Connection.prototype = {
	respond: function(status, body, type) {
		var header = [
			["Content-Type", type],
			["Content-Length", body.length]];
		this.res.writeHead(status, header);
		this.res.write(body);
		this.res.end();
	},

	json: function(obj, code) {
		code || (code = 200);
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
			readFile(__dirname + '/' + path, 'utf8', function(err, data) {
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
//  if there are none, adds the connection to server.long_connections 
Routes["/listen"] = function(connection) {
	// var since = parseInt(connection.params.since || 0, 10),
	//  messages = channel.messagesSince(since);
	// if (messages.length > 0) connection.json(messages);
	// else 
	server.long_connections.push(connection);
};

//endpoint for clients that want to join or "log in"
//  expects session_id query param
//  joins the default channel
//  returns the resulting session object
Routes["/join"] = function(connection) {
	var session = node_sessions.create(connection.params.session_id, connection.params);
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
		  node_sessions.destroy(connection.params.session_id);
		}
	} finally {
		connection.json({});
		return;
	}
};

Routes["/publish"] = function(connection) {
	var channel = connection.params.channel;
	data = connection.params.message;
	channels.publish(channel, data);
};

//stores the browser window session
var NodeSessions = function(){
  this.sessions = {};
};

NodeSessions.prototype = {
	create: function(session_id, params) {
		sessions[session_id] = params;
		return {
			session_id: session_id
		};
	},

	destroy: function(session_id) {
		delete this.sessions[session_id];
	},
	
	tellAll: function(channel, msg){
	  sys.puts("BROADCASTING: "+channel+" :::: "+ msg);
  	while (server.long_connections.length) {
			server.long_connections.shift().json([{channel: channel, message: msg}]);
		}
	}
};

node_sessions = new NodeSessions();

channels = new ChannelHost(CHANNEL_CACHE_DURATION);

channels.firehose(function(channel, msg) {
  node_sessions.tellAll(channel, msg);
});
