var speedtest = require('speedtest-net');
var sqlite3 = require('sqlite3');
var db = new sqlite3.Database(__dirname + '/data.db');

var create_table = 'CREATE TABLE IF NOT EXISTS speedtest ( ' +
  'upload REAL, download REAL, ping REAL, time DATETIME)';

var insert = 'INSERT INTO speedtest(time, upload, download, ping) VALUES (?, ?, ?, ?)';

db.serialize(() => {
  db.run(create_table);

  speedtest().on('data', data => {
    var speeds = data.speeds || {};
    var server = data.server || {};

    db.run(insert, (new Date()).toISOString(), speeds.upload, speeds.download, server.ping);
    db.close();
  });
});
