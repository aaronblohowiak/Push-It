//This manages the storage of messages in channels for ttl time
//  it notifies all observers when there are additions to the channel
//  by default, it keeps a cache of 30 seconds worth of messages so clients
//  can get some of the old messages on initial connection.
//  this solves race conditions.
//
//  Example use:
//    //Create a channel host that caches messages for 30 seconds
//    thirtySeconds = 30 * 1000;
//    channelHost = new ChannelHost(thirtySeconds);
//    channelHost.observe('channel', callback);
//
//    //Publish a message to the channel
//    channelHost.publish('channel', data);
//
//    //stop observing a channel
//    channelHost.ignore('channel', callback);
//    //get old data if in cache
//    channelHost.old('channel', since)
//
//this requires that you have my JavaScript-datastructures project in your $NODE_PATH
var ExpiringQueue = require('expiring-queue').ExpiringQueue,
	ReadThroughCacheSync = require('read-through-cache-sync').ReadThroughCacheSync;

var ChannelHost = function(timeToLive) {
	this.ttl = (timeToLive || (timeToLive = 5 * 1000));
	this.messageCache = new ReadThroughCacheSync(function() {
		return new ExpiringQueue(timeToLive);
	});

	this.observers = new ReadThroughCacheSync(function() {
		return [];
	});

	this.firehoseObservers = [];

	this.uniq = 0;
};

ChannelHost.prototype = {
	publish: function(channel, data) {
		var messages = this.messageCache.get(channel),
			now = (new Date()).getTime(),
			newMessage = {
			data: data,
			timestamp: now
		};

		messages.push(newMessage);

		//let's decouple the receipt of data from the notification
		// this might be better served with events
		var self = this;
		process.nextTick(function() {
			self.notify(channel, newMessage);
		});
	},

	notify: function(channel, data) {
		var observers = this.observers.get(channel);
		for (var i = observers.length - 1; i >= 0; i--) {
			observers[i](channel, data);
		};

		observers = this.firehoseObservers;
		for (i = observers.length - 1; i >= 0; i--) {
			observers[i](channel, data);
		};
	},

	observe: function(channel, callback) {
		var observers = this.observers.get(channel);
		observers.push(callback);
	},

	firehose: function(callback) {
		this.firehoseObservers.push(callback);
	},

	ignore: function(channel, callback) {
		var observers = this.firehoseObservers,
			idx = observers.indexOf(callback);
		if (idx > -1) observers.splice(idx, 1);
	},

	ignoreFirehose: function() {
		idx = observers.indexOf(callback);
		if (idx > -1) observers.splice(idx, 1);
	},

	old: function(channel, since) {
		var messages = this.messageCache.get(channel);
		var messagesToSend = messages.since(since);
		for (var i = messagesToSend.length - 1; i >= 0; i--) {
			callback(null, messagesToSend[i]);
		};
	}
};

exports.ChannelHost = ChannelHost;
