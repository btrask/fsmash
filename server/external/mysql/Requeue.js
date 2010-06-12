/* Copyright (c) 2010, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * The names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
var assert = require("assert");
var sys = require("sys");

var DEBUG = false;
var DISABLE = false;

exports.Requeue = function() {
	var requeue = this;
	var topQueue = [];
	var running = false;

	var debugStr = DEBUG ? function(msg, name) {
		sys.puts((name || "(unnamed)") + ": " + msg);
	} : function() {};

	var add = function(queue, func, name) {
		handler(queue, func, name, false);
	};
	var wait = function(queue, func, name) {
		return handler(queue, func, name, true);
	};
	var handler = function(queue, func, name, external) {
		assert.ok(func, "Function required");
		var subQueue = [], removed = false;
		var blocker = function() {
			debugStr("Blocking", name);
		};
		var caller = function(arg1, arg2, etc) {
			var original = {
				add: requeue.add,
				wait: requeue.wait,
			};
			var index = queue.indexOf(marker);
			if(removed) return debugStr("Unblocked after removing", name);
			if(external) debugStr("Unblocking", name);
			else debugStr("Running", name);
			assert.ok(-1 !== index, "Marker must be in queue (perhaps we were called twice)");
			queue.splice(index, 1);

			requeue.add = function(func, name) {
				add(subQueue, func, name);
			};
			requeue.wait = function(func, name) {
				return wait(subQueue, func, name);
			};
			func.apply(this, arguments);
			requeue.add = original.add;
			requeue.wait = original.wait;

			if(0 === index) next(subQueue);
			debugStr("Finished", name);
		};
		var next = function(queue) {
			if(queue.length) {
				debugStr("Continuing", name);
				return queue[0]();
			}
			if(queue.parent) return next(queue.parent);
			assert.ok(running, "Must be running");
			running = false;
			debugStr("Nothing left in queue", name);
		};
		var marker = external ? blocker : caller;
		queue.push(marker);
		subQueue.parent = queue;
		if(!external) return;
		var externalCaller = function(arg1, arg2, etc) {
			var args = arguments;
			process.nextTick(function() { // FIXME: Support sync unblocking instead of faking it.
				caller.apply(this, args);
			});
		};
		externalCaller.remove = function() {
			var index = queue.indexOf(marker);
			if(-1 !== index) queue.splice(index, 1);
			removed = true;
		};
		return externalCaller;
	};

	requeue.addAtTop = function(func, name) {
		if(DISABLE) {
			func();
			return;
		}
		add(topQueue, func, name);
		if(running) return;
		running = true;
		debugStr("Starting", name);
		topQueue[0]();
	};

	requeue.add = requeue.addAtTop;
	requeue.wait = function(func, name) {
		if(DISABLE) {
			var caller = function(arg1, arg2, etc) {
				return func.apply(this, arguments);
			}
			caller.remove = function() {};
			return caller;
		}
		running = true;
		return wait(topQueue, func, name);
	};

	requeue.multiWait = function(name) {
		var interceptor = requeue.wait(function(func, args) {
			return func.apply(this, args);
		}, name);
		var maker = function(func) {
			return function(arg1, arg2, etc) {
				return interceptor.call(this, func, arguments);
			};
		};
		maker.remove = function(arg1, arg2, etc) {
			interceptor.remove.apply(interceptor, arguments);
		};
		return maker;
	};
};
