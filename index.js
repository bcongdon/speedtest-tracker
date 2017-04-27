#!/usr/bin/env node

var speedtest = require('speedtest-net');
var sqlite3 = require('sqlite3');
var program = require('commander');
var db = new sqlite3.Database(__dirname + '/data.db');

var create_table = 'CREATE TABLE IF NOT EXISTS speedtest ( ' +
  'upload REAL, download REAL, ping REAL, time DATETIME)';
var insert = 'INSERT INTO speedtest(time, upload, download, ping) VALUES (?, ?, ?, ?)';
var clear_table = 'DELETE FROM speedtest';
var stats_sql = 'SELECT AVG(upload), MAX(upload), ' + 
  'AVG(download), MAX(download), AVG(ping), MAX(ping) FROM speedtest;'

function doSpeedTest(cb) {
  speedtest().on('data', data => {
    var speeds = data.speeds || {};
    var server = data.server || {};
    cb({
      upload: speeds.upload,
      download: speeds.download,
      ping: server.ping
    });
  });
}

function makeMeasurement(cb) {
  db.run(create_table);
  doSpeedTest(data => {
    db.run(insert, (new Date()).toISOString(), data.upload, data.download, data.ping);
    db.close();
    cb(data);
  });
}

function measurementAction() {
  console.log('* Starting measurement');
  makeMeasurement(results => {
    console.log('* Measurement Results: ');
    console.log(`\tupload: ${results.upload} Mb/s`);
    console.log(`\tdownload: ${results.download} Mb/s`);
    console.log(`\tping: ${results.ping} ms`);
  });
}

program
  .command('clear')
  .description('Clear all previous measurements')
  .action(() => {
    db.serialize(() => {
      db.run(clear_table);
    });
  });

program
  .command('measure')
  .description('Make a new speedtest measurement')
  .action(measurementAction);

program
  .command('stats')
  .description('Displays speedtest stats')
  .action(() => {
    db.get(stats_sql, (err, data) => {
      console.log(data);
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  // Default action without cli command
  measurementAction();
}
