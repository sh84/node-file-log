var fs = require('fs'), assert = require("assert"), util = require('util');

const LOG_LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	fatal :4
};
var log_level = 2;
var stdout;
var filename;
var airbrake;

for (var name in LOG_LEVELS) {
	console[name] = function(name) {
		log(name, Array.prototype.slice.call(arguments, 1));
	}.bind(this, name);
} 

function log(name, args) {
	if (LOG_LEVELS[name] >= log_level) {
		var s = '[' + getTime() + '] [' + name.toUpperCase() + '] ['+process.pid+'] ';
		s += util.format.apply(util.format, args);
		if (process.stdout.writable) process.stdout.write(s + '\n');
	}
}

function getTime() {
	d = new Date();
	return d.getFullYear() + '-' + addZero(d.getMonth() + 1) + '-' + addZero(d.getDate()) + ' ' + 
		addZero(d.getHours()) + ':' + addZero(d.getMinutes()) + ':' + addZero(d.getSeconds()) + 
		'.' + add2Zero(d.getMilliseconds());
}

function addZero(val) {
	return (val >= 10) ? val : '0'+val;
}

function add2Zero(val) {
	return (val >= 10) ? ((val >= 100) ? val : '0'+val) : '00'+val;
}

// All system error -> console.fatal
process.on('uncaughtException', function(err) {
	if (airbrake) {
		airbrake._onError(err, true);
	} else {
		console.fatal('Uncaught exception:', (err.message || err), err.stack);
		if (process.stdout.isTTY) {
			process.exit();
		} else {
			process.stdout.end(null, null, function() {
				process.exit();
			});
		}
	}
});

console.setLevel = function(level, _airbrake) {
	if (_airbrake && _airbrake.constructor.name == 'Airbrake') {
		airbrake = _airbrake;
	}
	level = (level || '').toLowerCase();
	assert(LOG_LEVELS[level] != null, 'Log level shoud be:'+Object.keys(LOG_LEVELS).join(', '));
	log_level = LOG_LEVELS[level];
	return console;
};

console.setFile = function(file, callback) {
	if (! file) {
		callback();
	} else {
		stdout = fs.createWriteStream(file, {flags: 'a', mode: 0644, encoding: 'utf8'});
		stdout.addListener('error', function(err) {
			console.fatal('Log create', err);
			callback(err);
		}).addListener('open', function() {
			filename = file;
			process.__defineGetter__("stdout", function() {
				return stdout;
			});
			process.__defineGetter__("stderr", function() {
				return stdout;
			});
			console.log = function() {
				if (process.stdout.writable) process.stdout.write(util.format.apply(this, arguments) + '\n');
			};
			if (callback) callback();
		});
	}
	return console;
};

console.reopen = function(callback) {
	if (stdout) {
		stdout.end();
		console.setFile(filename, function() {
			stdout.write('[' + getTime() + '] Reopen log file by SIGUSR1\n');
			if (callback) callback();
		});
	}
};

process.on('SIGUSR1', function() {
	console.reopen();
});

module.exports = console;
