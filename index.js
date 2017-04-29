#!/usr/bin/env node

var speedtest = require('speedtest-net');
var sqlite3 = require('sqlite3');
var program = require('commander');
var fs = require('fs');
var blessed = require('blessed');
var contrib = require('blessed-contrib');

var db = new sqlite3.Database(__dirname + '/data.db');

var create_table = 'CREATE TABLE IF NOT EXISTS speedtest ( ' +
  'upload REAL, download REAL, ping REAL, time DATETIME)';
var insert = 'INSERT INTO speedtest(time, upload, download, ping) VALUES (?, ?, ?, ?)';
var clear_table = 'DELETE FROM speedtest';
var stats_sql = 'SELECT AVG(upload), MAX(upload), ' + 
  'AVG(download), MAX(download), AVG(ping), MAX(ping) FROM speedtest;';
var all_data = 'SELECT * from speedtest';

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
  .option('-l, --last [day, week, month]', 'Stats time period to consider')
  .action(() => {
    db.get(stats_sql, (err, data) => {
      if(err) throw err;
      console.log(data);
    });
  });

program
  .command('chart')
  .description('Shows chart of measurements over time')
  .option('-l, --last [day, week, month]', 'Stats time period to consider')
  .action(() => {
    db.all(all_data, (err, data) => {
      if(err) throw err;
      var screen = blessed.screen();
      var grid = new contrib.grid({rows: 2, cols: 2, screen: screen});

      // Setup ping line chart
      var ping_line = grid.set(0, 0, 1, 1, contrib.line, {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        showLegend: true,
        xLabelPadding: 3,
        xPadding: 5,
        label: 'Ping (ms)'
      });
      var ping_series = {
        title: 'Ping',
        x: data.map((d) => {return d.time;}),
        y: data.map((d) => {return d.ping;})
      };
      ping_line.setData([ping_series]);

      // Setup upload/download chart
      var updown_line = grid.set(0, 1, 1, 1, contrib.line, {
        style: {
          text: 'green',
          baseline: 'black'
        },
        showLegend: true,
        xLabelPadding: 3,
        xPadding: 5,
        label: 'Upload/Download Speed (Mb/s)'
      });
      var up_series = {
        title: 'Upload',
        x: data.map((d) => {return d.time;}),
        y: data.map((d) => {return d.upload;}),
        style: {
          line: 'blue'
        }
      };
      var down_series = {
        title: 'Download',
        x: data.map((d) => {return d.time;}),
        y: data.map((d) => {return d.download;}),
        style: {
          line: 'green'
        }
      };
      updown_line.setData([up_series, down_series]);

      screen.key(['escape', 'q', 'C-c'], () => {
        return process.exit(0);
      });
      screen.render();
    });
  });

program
  .command('dump <file>')
  .description('Dump measurements to a file in CSV format')
  .action((file) => {
    db.all(all_data, (err, data) => {
      if(err) throw err;
      var csv_str = 'time,ping,download,upload\n';
      data.forEach((m) => {
        csv_str += `${m['time']},${m.ping},${m.download},${m.upload}\n`;
      });
      fs.writeFile(file, csv_str, (err) => {
        if(err) throw err;
      });
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  // Default action without cli command
  measurementAction();
}
