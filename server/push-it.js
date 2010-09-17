require.paths.unshift(__dirname+"/lib/");
require.paths.unshift(__dirname+"/models/");
require.paths.unshift(__dirname+"/mqs/");

var socketIo = require(__dirname+'/lib/socket.io'),
    http = require('http'),
    uuid = require('uuid').uuid,
    help = require('help').help,
    inspect = require("sys").inspect,
    Agent = require("agent"),
    Channel = require("channel"),
    InMemoryMQ = require("in_memory"),
    proto = require(__dirname+'/lib/push-it-proto'),
    SubscriptionManager = require("subscription_manager");

//TODO: real options parsing
var PushIt = function(server, options){
  if(!options.nohelp) help();
  
  this.server = server;
  this.io = socketIo.listen(this.server);  
  this.setupIO();

  
  this.mq = new InMemoryMQ();

  this.channels = {};
  this.subscriptionManager = new SubscriptionManager(this.mq);
};

PushIt.prototype = proto;

exports.PushIt = PushIt;
