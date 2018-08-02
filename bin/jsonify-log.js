#!/usr/bin/env node

const DEFAULT_FIELDS = ['time', 'pid', 'level'];
const HTTP_FIELDS = ['remote_address', 'method', 'url', 'status'];
const {createInterface: readlineCreateInterface} = require('readline');

let readline_interface = readlineCreateInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

readline_interface.on('line', function(line) {
  let input_data = line.trim();
  let parsing_result = parseInputData(input_data);
  console.log(parsing_result);
});

function parseInputData(input_data, recursion_call) {
  let parsed_data = getJSONData(input_data);
  if (parsed_data) {
    return formatObject(parsed_data);
  } else {
    // If JSON parsing failed in recursion call
    // Return the input_data to avoid stack size exceeded errors
    if (recursion_call) {
      return input_data;
    }
    let result_string = input_data;
    let simple_json_regexp = /\{.*\}/g;
    // Lookig for something similar to JSON
    let matches = input_data.match(simple_json_regexp);
    // If matches found
    if (matches) {
      let parsing_result = [];
      // Parse each match
      for (let matched_string of matches) {
        parsing_result.push(parseInputData(matched_string.trim(), true));
      }
      let parsed_result_index = 0;
      // Replace each match with it parsing result
      result_string = result_string.replace(simple_json_regexp, function() {
        return parsing_result[parsed_result_index++];
      });
    }
    return result_string;
  }
}

function getJSONData(item) {
  try {
    return JSON.parse(item);
  } catch (e) {
    return false;
  }
}

function formatObject(obj) {
  let msg = '';
  msg += formatDefaultFields(obj);
  msg += formatWebServerFields(obj);
  msg += formatCustomFields(obj);
  return msg;
}

function formatDefaultFields(obj) {
  let result = '';
  // If obj contains all default fields
  if (DEFAULT_FIELDS.every(field => typeof obj[field] !== 'undefined')) {
    // Add this string representation to result
    result += `${obj['time']} [${obj['pid']}] ${obj['level']}: `;
    // Delete properties to avoid duplicates in output
    DEFAULT_FIELDS.forEach(f => delete obj[f]);
  }
  return result;
}

function formatWebServerFields(obj) {
  let result = '';
  // If obj contains all http fields
  if (HTTP_FIELDS.every(field => typeof obj[field] !== 'undefined')) {
    // Length field can be undefined
    let length = obj['length'] ? `[${obj['length']}]` : '\b';
    // Answer time is optional
    let answer_time = obj['answer_time'] ? `, ${obj['answer_time']}ms ` : '';
    // Add this string representation to result
    result += `${obj['remote_address']} ${obj['method']} ${obj['url']} -> ${length} ${obj['status']}${answer_time} `;
    // Delete properties to avoid duplicates in output
    ['answer_time', 'length'].concat(HTTP_FIELDS).forEach(f => delete obj[f]);
  }
  return result;
}

function formatCustomFields(obj) {
  const INDENT_SYMBOL = '  ';
  return JSON.stringify(obj, null, INDENT_SYMBOL).replace(/\"([^(\")"]+)\":/g,"$1:").replace(/\\n/g, "\n");
}
