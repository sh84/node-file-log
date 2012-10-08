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

for (var name in LOG_LEVELS) {
	console[name] = function(name) {
		log(name, Array.prototype.slice.call(arguments, 1));
	}.bind(this, name);
} 

function log(name, args) {
	if (LOG_LEVELS[name] >= log_level) {
		var s = '[' + getTime() + '] [' + name.toUpperCase() + '] ';
		s += util.format.apply(util.format, args);
		if (process.stdout.writable) process.stdout.write(s + '\n');
	}
}

function getTime() {
	d = new Date();
	return d.getFullYear() + '-' + addZero(d.getMonth() + 1) + '-' + addZero(d.getDate()) + ' ' + 
		addZero(d.getHours()) + ':' + addZero(d.getMinutes()) + ':' + addZero(d.getSeconds()) + 
		'.' +	d.getMilliseconds();
}

function addZero(val) {
	return (val >= 10) ? val : '0'+val;
}

// All system error -> console.fatal
process.on('uncaughtException', function(err) {
	console.fatal('Uncaught exception:', (err.message || err), err.stack);
	process.exit();
});

console.setLevel = function(level) {
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