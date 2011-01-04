var test = {},
    uuid = require("uuid-pure").newId,
    assert = require('assert');
    
module.exports = test;

test["uuid should return only 0-9a-zA-Z\-_ so we can have url-safe uuids"] = function(){
  var guid = uuid(),
      validChars = guid.match(/[\da-zA-Z\-_]/g).length,
      len = guid.length;
  assert.equal(validChars, len, guid + " has "+validChars+" when it should have "+len );
};

test["uuid should return 22 chars by default"] = function(){
  var guid = uuid(),
      len = guid.length;
  assert.equal(len, 22, guid + " should be 22 chars long, it was "+len);
};

test["uuid should respect a length param"] = function(){
  var guid = uuid(10);
  assert.equal(guid.length, 10, guid + "should be 10 chars long");
};

test["uuid should be respect a 'base' param"] = function(){
  var guid = uuid(100, 36),
      validChars = guid.match(/[\dA-Z]/g).length,
      len = guid.length;
  
  assert.equal(validChars, len, guid + " has "+validChars+" when it should have "+len );
};

