const fs = require('fs'), assert = require("assert"), util = require('util');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};
let curr_log_level = 2;
let fd;
let fd_uncork_timer;
let fd_buffer_flush_time;
let filename;
let airbrake;
let is_json_format = false;

for (let level of Object.keys(LOG_LEVELS)) {
  let up_case_level = level.toUpperCase();
  console[level] = function(...args) {
    log(LOG_LEVELS[level], up_case_level, args);
  };
}

function log(log_level, level_name, args) {
  if (log_level >= curr_log_level) {
    if (is_json_format) {
      let obj = typeof args[0] === 'string' ? {msg: args[0]} : args[0];
      obj['pid'] = process.pid;
      obj['level'] = level_name;
      obj['time'] = getTime();
      console.log_ ? console.log_(JSON.stringify(obj)) : console.log(JSON.stringify(obj))
    } else {
      let s = '[' + getTime() + '] [' + level_name + '] ['+process.pid+'] ';
      console.log(s, args);
    }
  }
}

function getTime() {
  let d = new Date();
  return d.getFullYear() + '-' + addZero(d.getMonth() + 1) + '-' + addZero(d.getDate()) + ' ' + 
    addZero(d.getHours()) + ':' + addZero(d.getMinutes()) + ':' + addZero(d.getSeconds()) + 
    '.' + add2Zero(d.getMilliseconds());
}

function addZero(val) {
  return (val >= 10 ? '' : '0')+val;
}

function add2Zero(val) {
  return (val >= 10 ? (val >= 100 ? '' : '0') : '00')+val;
}

// All system error -> console.fatal
process.on('uncaughtException', function(err) {
  if (is_json_format) {
    console.fatal({msg: 'Uncaught exception', error: err.message || err, stack: err.stack});
  } else {
    console.fatal('Uncaught exception:', err.message || err, err.stack);
  }
  if (airbrake) {
    airbrake.notify(err, function(notify_err, url, devMode) {
      if (notify_err) {
        if (is_json_format) {
          console.fatal({msg: 'Airbrake: Could not notify service.', error: notify_err.message || notify_err, stack: notify_err.stack});
        } else {
          console.fatal('Airbrake: Could not notify service:', notify_err.message || notify_err, notify_err.stack);
        }
      } else if (devMode) {
        console.log('Airbrake: Dev mode, did not send.');
      } else {
        console.log('Airbrake: Notified service: ' + url);
      }
      console.processExit(1);
    });
  } else {
    console.processExit(1);
  }
});

console.processExit = function(code) {
  if (fd) {
    fd.end(null, null, function() {
      process.exit(code);
    });
  } else {
    process.exit(code);
  }
};

console.setLevel = function(level) {
  level = (level || '').toLowerCase();
  assert(LOG_LEVELS[level] != null, 'Log level shoud be:'+Object.keys(LOG_LEVELS).join(', '));
  curr_log_level = LOG_LEVELS[level];
  return console;
};

console.setAirbrake = function(_airbrake) {
  if (_airbrake && _airbrake.constructor.name == 'Airbrake') {
    airbrake = _airbrake;
  }
  return console;
};

console.setJSONFormat = function(json_format) {
  is_json_format = json_format;
  if (json_format && !('toJSON' in Error.prototype)) {
    Object.defineProperty(Error.prototype, 'toJSON', {
      value() {
        let alt = {};
        Object.getOwnPropertyNames(this).forEach(key => {
          alt[key] = this[key];
        }, this);
        return alt;
      },
      configurable: true,
      writable: true
    });
  }
  return console;
};

console.setFileBufferFlushTime = function(time) {
  fd_buffer_flush_time = time;
  if (fd_uncork_timer) {
    clearInterval(fd_uncork_timer);
    fd_uncork_timer = null;
  }
  if (fd) {
    if (!time) {
      fd.uncork();
    } else {
      fd.cork();
      fd_uncork_timer = setInterval(function() {
        fd.uncork();
        fd.cork();
      }, fd_buffer_flush_time);
    }
  }
  return console;
};

console.setFile = function(file, callback) {
  if (!file) {
    if (callback) callback();
  } else {
    fd = fs.createWriteStream(file, {flags: 'a', mode: 0o644, encoding: 'utf8'});
    fd.addListener('error', function(err) {
      if (is_json_format) {
        console.fatal({msg: 'Log create error', error: err});
      } else {
        console.fatal('Log create error', err);
      }
      if (callback) callback(err);
    }).addListener('open', function() {
      console.log = function(...args) {
        if (fd.writable) fd.write(util.format(...args) + '\n');
      };
      console.log_ = function(str) {
        if (fd.writable) fd.write(str + '\n');
      };
      filename = file;
      console.setFileBufferFlushTime(fd_buffer_flush_time);
      if (callback) callback();
    });
  }
  return console;
};

console.reopen = function(callback) {
  if (fd) {
    fd.end();
    console.setFile(filename, function() {
      console.log('Reopen log file by SIGUSR1');
      if (callback) callback();
    });
  }
};

process.on('SIGUSR1', function() {
  console.reopen();
});

module.exports = console;
