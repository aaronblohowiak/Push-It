var io = require(__dirname+'/../../server/lib/socket.io');

    HOST = null; // localhost
    PORT = 8080;
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
    	http = require("http"),
    	createServer = http.createServer,
    	url = require("url"),
    	querystring = require("querystring"),
    	readFile = require("fs").readFile,
    	net = require("net"),
    	connect = require('connect');

    //our main http connection handler
    function cxn(request, response) {
    	try {
    		puts((new Date()).toString() + " " + "New connection: " + request.url);
    		new HTTPConnection(request, response);
    	} catch(err) {
    		sys.puts(err + err.trace);
    	}
    }

    server = connect.createServer(cxn);
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
    	this.path = this.url_info.pathname;	 
    	this.host = request.headers.host;
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
    		var header = {
    		  "Content-Type": type,
    			"Content-Length": body.length
    		};
    		this.res.writeHead(status, header);
    		this.res.write(body);
    		this.res.end();
    	},

      html:function(body, code) {
      	body || (body = "");
    		code || (code = 200);
    		this.respond(code, body, "text/html");
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
    	},

    	redirect: function(url, code){
    	  code || (code = 302);

    	  body = "You are now being redirected to: " + url;
    	  var header = {
    		  "Content-Type": "text/plain",
    			"Content-Length": body.length,
    			"Location": url
    		};

    		this.res.writeHead(code, header);
    		this.res.write(body);
    		this.res.end();		
    	}
    };

    //Routes object is a path to handler map
    Routes = {};
    Routes.static_prefix = __dirname + '/static';

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
    //	sys.puts("current routes:"+ sys.inspect(Routes));
    //	sys.puts("trying to load static file: "+ __dirname + '/' + path);
    	if(path.charAt(path.length - 1) == "/"){
    	  path = path + "index.html";
    	}
    	sys.puts("missing: "+path);
    	
      
      if (/^\/client\//.test(path)){
//				try {
				  var res = connection.res;
					var swf = path.substr(-4) === '.swf';
					res.writeHead(200, {'Content-Type': swf ? 'application/x-shockwave-flash' : ('text/' + (path.substr(-3) === '.js' ? 'javascript' : 'html'))});
					readFile(__dirname + path, swf ? 'binary' : 'utf8', function(err, data){
						if (!err) res.write(data, swf ? 'binary' : 'utf8');
						res.end();
					});
//				} catch(e){ 
	//			  connection.notFound({});
//				}
			} else{
			 	readFile(this.static_prefix + path, function(err, data) {
      		if (err) connection.notFound({});
      		else connection.respond(200, data, "text/" + path.split('.').slice(-1));
      	}); 
			}
    };

    Routes["/"] = function(connection) {
    	readFile(__dirname + '/static/index.html', 'utf8', function(err, data) {
    	  if (err){
    	    connection.notFound({});
    	  } 
    	  else connection.respond(200, data, "text/html");
    	});
    };


    exports.Routes = Routes;

var io2 = io.listen(server);


var buffer = [];
		
io2.on('connection', function(client){
	client.send({ buffer: buffer });
	client.broadcast({ announcement: client.sessionId + ' connected' });

	client.on('message', function(message){
		var msg = { message: [client.sessionId, message] };
		buffer.push(msg);
		if (buffer.length > 15) buffer.shift();
		client.broadcast(msg);
	});

	client.on('disconnect', function(){
		client.broadcast({ announcement: client.sessionId + ' disconnected' });
	});
});