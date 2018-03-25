console.log("Starting ThermostatMonitor on " + process.platform + " with node version " + process.version);

require('dotenv').config({ path: './config.env' });
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var rp = require('request-promise-native');
var schedule = require('node-schedule');
var mysql = require('mysql');
var fetch = require('node-fetch');

console.log("All External Dependancies Found\n");

if (typeof process.env.pollPeriodMs === 'undefined' || process.env.pollPeriodMs === null) {
    process.env.pollPeriodMs = 300000;
}

var thermometerIPAddress = "192.168.1.82";
var devices = [];
var pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.dbhost,
    user: process.env.dbuser,
    //password: 'password',
    database: process.env.dbname
});

if (!Date.prototype.toSQLString) {
    (function () {
        
        function pad(number) {
            if (number < 10) {
                return '0' + number;
            }
            return number;
        }
        
        Date.prototype.toSQLString = function () {
            //return this.format("yyyy-mm-dd hh-MM-ss");
            return this.getUTCFullYear() +
                '-' + pad(this.getUTCMonth() + 1) +
                '-' + pad(this.getUTCDate()) +
                ' ' + pad(this.getUTCHours()) +
                '-' + pad(this.getUTCMinutes()) +
                '-' + pad(this.getUTCSeconds());
        };
    }());
}

var logInterval;
var prevTstat;

var port = Number(process.env.nodeport) || 4454;
app.use(express.static('public'));
app.use(express.static('node_modules/socket.io/node_modules'));

function init() {
    StartLog();
}
init();

app.get('/', function (req, res) {
    res.sendFile('index.html')
});

app.get('/GetDevices', function (req, res) {
    GetDevices().then(function (tstats) {
        res.send(tstats);
    }, function (failure) {
        res.send(failure);
    });
});

app.get('/AddDevice', function (req, res) {
    var newConfig = req.query.update;
    var sql = 'INSERT INTO ' + process.env.dbdevices + ' SET ?';

    pool.query(sql, newConfig, function (dberr, dbres, dbfields) {
        res.send(dberr);
        if (!dberr)
            GetDevices().then(function (tstats) {
            }, function (failure) {
            });
    });
});

app.get('/RemoveDevice', function (req, res) {
    var address = req.query.address;
    var sql = 'DELETE FROM ' + process.env.dbdevices + ' WHERE address=?';

    pool.query(sql, address, function (dberr, dbres, dbfields) {
        res.send(dberr);
        if (!dberr)
            GetDevices().then(function (tstats) {
            }, function (failure) {
            });
    });
});

app.get('/UpdateDevice', function (req, res) {
    var prevConfig = req.query.previous;
    var newConfig = req.query.update;
    var sql = 'UPDATE ' + process.env.dbdevices + ' SET ? WHERE address=' + prevConfig.address;

    pool.query(sql, [newConfig], function (dberr, dbres, dbfields) {
        res.send(dberr);
        if (!dberr)
            GetDevices().then(function (tstats) {
            }, function (failure) {
            });
    });
});

app.get('/StartLog', function (req, res) {
    console.log('/StartLog ');
    StartLog();
    res.send({ succeeded: true });
});

app.get('/StopLog', function (req, res) {
    clearInterval(logInterval);
    res.send({ succeeded: true });
});

var heatLossMeasureJob;
app.get('/HeatLossMeasure', function (req, res) {
    var startValue = Number(req.query.start);
    var start;
    if (startValue) start = new Date(startValue);
    var stopValue = Number(req.query.stop);
    var stop;
    if (stopValue) stop = new Date(stopValue);

    var hold = Number(req.query.hold);
    
    var startJob = schedule.scheduleJob(start, function (hold, stop) {
        SetFanMode(thermometerIPAddress, FanMode.on, function (err, res) {
            console.log('SetFanMode');
            if(err) console.log(err);
            if (res) console.log(res);
            SetTempHeat(thermometerIPAddress, hold, function (err, res) {
                console.log('SetTempHeat');
                if (err) console.log(err);
                if (res) console.log(res);
                SetRunMode(thermometerIPAddress, RunMode.heat, function (err, res) {
                    console.log('SetRunMode');
                    if (err) console.log(err);
                    if (res) console.log(res);
                });
            });
        });

    }(hold, stop));
});

app.get('/HeatLossAbort', function (req, res) {
    console.log('/HeatLossAbort');

});

app.get('/Plot', function (req, res) {
    var beginDateTime = req.query.begin;
    var endDateTime = req.query.end;

    GetLog(beginDateTime, endDateTime).then(function (logData) {
        res.send(logData);
    }).then(function (failure) {
        res.send(failure);
    });
});

io.on('connection', function (socket) {
    socket.broadcast.emit('Server Connected');
    socket.on('disconnect', function () {
        console.log('Socket.IO  disconnected ' + socket.id);
    });
    socket.on('connect_failed', function () {
        console.log('socket.io connect_failed');
    })
    socket.on('reconnect_failed', function () {
        console.log('socket.io reconnect_failed');
    })
    socket.on('error', function (err) {
        console.log('socket.io error:' + err);
    })
    socket.on('Action', function (data) {
        console.log('Action ' + JSON.stringify(data));
    });
});


function  StartLog() {
    if (logInterval) clearInterval(logInterval);
  
    try {
        if (process.env.pollPeriodMs > 0) {
            GetDevices().then(function (tstats) {
                Record(tstats);

                logInterval = setInterval(function () {
                    GetDevices().then(function (tstats) {
                        Record(tstats);
                    });
                }, process.env.pollPeriodMs);

            }, function (failure) {
                io.sockets.emit('status', err);
            });
        }
    }
    catch (err) {
        io.sockets.emit('status', err);
    }
}

function GetDevices() {
    return new Promise(function (resolve, reject) {
        var connectionString = 'SELECT * FROM `' + process.env.dbdevices + '`';
        pool.query(connectionString, function (dberr, dbres, dbfields) {
            if (dberr)
                reject(dberr);
            else {
                devices = dbres;
                resolve(dbres);
            }
        });
    });
}

function CurrentState(ipAddr, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request(reqestStr, function (error, response, body) {
        if (!error && response && response.statusCode == 200 && body) {
            // Might have a good response.  Check data
            var state = JSON.parse(body);
            if (state && state.temp > 0 && (state.t_heat > 0 || state.t_cool > 0)) {
                // Good response.  Send it back
                callback(error, state);
            }
        }

        else { // Bad response.  2nd try
            request(reqestStr, function (error, response, body) {
                var state;  // Start uninitialized.  Initialize if good.
                if (error) {
                    callback(error, state);
                }
                else if (!response || !body) {
                    callback(new Error("Request data error"), state);
                }
                else if (response.statusCode == 200) {
                    state = JSON.parse(body);

                    if (state.temp <= 0 && (state.t_heat <= 0 || state.t_cool <= 0)) {
                        // Bad response.  Return it
                        error = new Error("Bad thermostat data");
                    }
                }
                else {
                    error = new Error(reqestStr + " failed status " + response.statusMessage + " error " + error);
                }

                callback(error, state);
            });
        }
    });
}

async function CurrentStateA(ipAddr, retry=3) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    var response;
    for (var i = 0; i < retry && response === undefined; i++) {
        response = await rp(reqestStr)
    }
    try {

    }
    catch (err) {
    }
    response = await rp(reqestStr, function (error, response, body) {
        if (!error && response && response.statusCode == 200 && body) {
            // Might have a good response.  Check data
            var state = JSON.parse(body);
            if (state && state.temp > 0 && (state.t_heat > 0 || state.t_cool > 0)) {
                // Good response.  Send it back
                callback(error, state);
            }
        }

        else { // Bad response.  2nd try
            request(reqestStr, function (error, response, body) {
                var state;  // Start uninitialized.  Initialize if good.
                if (error) {
                    callback(error, state);
                }
                else if (!response || !body) {
                    callback(new Error("Request data error"), state);
                }
                else if (response.statusCode == 200) {
                    state = JSON.parse(body);

                    if (state.temp <= 0 && (state.t_heat <= 0 || state.t_cool <= 0)) {
                        // Bad response.  Return it
                        error = new Error("Bad thermostat data");
                    }
                }
                else {
                    error = new Error(reqestStr + " failed status " + response.statusMessage + " error " + error);
                }

                callback(error, state);
            });
        }
    });
}

function RunLog(ipAddr, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat/datalog/';
     request(reqestStr, function (error, response, body) {
        var log;
        if (!error && response.statusCode == 200) {
            log = JSON.parse(body);
        }
        if (log) {
            callback(error, log);
        }
        else { // 2nd try
            request(reqestStr, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    log = JSON.parse(body);
                }
                if (!error || !log ) {
                    error = reqestStr + " retry failed.";
                }
                callback(error, log);
            });
        }
    });
}

function TargetTemperature(ipAddr, callback){
    var reqestStr = 'http://' + ipAddr + '/tstat/ttemp/';
    request(reqestStr, function (error, response, body) {
        var targetTemperature;
        if (!error) {
            targetTemperature = JSON.parse(body);
        }
        else {
            console.log("TargetTemperature failure");
            console.log(error);
        }
        callback(error, targetTemperature);
    });
}

var RunMode = { off : 0, heat: 1, cool : 1, auto: 3};
function SetRunMode(ipAddr, runMode, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { tmode: runMode }
    }, 
        function (e, r, body) {
            if (e) {
                console.log("SetRunMode failure");
                console.log(e);
            }
            callback(e, r.statusMessage)
        }
    );
}

var FanMode = { auto: 0, circulate: 1, on: 2};
function SetFanMode(ipAddr, fanMode, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { fmode: fanMode }
    }, 
       function (e, r, body) {
            if (e) {
                console.log("SetFanMode failure");
                console.log(e);
            }
            callback(e, r.statusMessage)
        }
    );
}

function SetTempHeat(ipAddr, temperature, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { t_heat: temperature }
    }, 
       function (e, r, body) {
            if (e) {
                console.log("SetTempHeat failure");
                console.log(e);
            }
            callback(r.statusMessage)
        }
    );
}

function SetTempCool(ipAddr, temperature, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { t_cool: temperature }
    }, 
       function (e, r, body) {
            if (e) {
                console.log("SetTempCool failure");
                console.log(e);
            }
            callback(r.statusMessage)
        }
    );
}

function TemperatureSwing(ipAddr, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat/tswing/';
    request(reqestStr, function (error, response, body) {
        var tempSwing;
        if (!error) {
            tempSwing = JSON.parse(body);
        }
        else {
            console.log("TemperatureSwing failure");
            console.log(error);
        }
        callback(error, tempSwing);
    });
}

function ThermostatConditions(tstat) {
    return new Promise(function (resolve, reject) {
        try {
            CurrentState(tstat.address, function (eStatus, cStatus) {
                RunLog(tstat.address, function (eLog, rLog) {
                    var result = {
                        errStatus: eStatus,
                        errLog: eLog,
                        status: cStatus,
                        log: rLog
                    };
                    resolve(result);
                });
            });
        }
        catch (err) {
            reject(err);
        }
    });
}

async function GetNoaaWeather(lat, lon) {
    try {
        var url = 'http://forecast.weather.gov/MapClick.php?FcstType=json&lat=' + lat + '&lon=' + lon;
        var response = await fetch(url);
        var weatherJson = await response.json();
        return weatherJson;
    }
    catch (err) {
        throw err;
    }
}

async function Record(tstats) {
    var weather = await GetNoaaWeather(45.516545019252334, -122.90274007259009);
    var currentWeather = weather.currentobservation;
    for (let tstat of tstats) {
        result = await ThermostatConditions(tstat);
        var record = {
            address: tstat.address,
            date: new Date(),
            exteriorTemperature: Number(currentWeather.Temp),
            interiorTemperature: result.status.temp,
            targetTemperature: isNaN,
            weather: currentWeather.Weather,
            windDir: currentWeather.Windd,
            windSpeed: currentWeather.Winds,
            relativeHumidity: currentWeather.Relh,
            visibility: currentWeather.Visibility,
            fanOn: result.status.fstate == 1,
            heatOn: result.status.tstate == 1,
            coolOn: result.status.tstate == 2,
            override: result.status.override,
            hold: result.status.hold,
            todayCoolRuntimeHours: result.log.today.cool_runtime.hour,
            todayCoolRuntimeMinutes: result.log.today.cool_runtime.minute,
            todayHeatRuntimeHours: result.log.today.heat_runtime.hour,
            todayHeatRuntimeMinutes: result.log.today.heat_runtime.minute
        };

        if (result.status.t_heat) {
            record.targetTemperature = result.status.t_heat;
        }
        else if (result.status.t_cool) {
            record.targetTemperature = result.status.t_cool;
        }
        await pool.query('INSERT INTO tstat_log SET ?', record); // Record to DB
        io.sockets.emit('status', record); // Send record to listening clients
    }

        /*
        ThermostatConditions(tstat).then(result => {
            var record = {
                address: tstat.address,
                date: new Date(),
                exteriorTemperature: Number(currentWeather.Temp),
                interiorTemperature: result.status.temp,
                targetTemperature: isNaN,
                weather: currentWeather.Weather,
                windDir: currentWeather.Windd,
                windSpeed: currentWeather.Winds,
                relativeHumidity: currentWeather.Relh,
                visibility: currentWeather.Visibility,
                fanOn: result.status.fstate == 1,
                heatOn: result.status.tstate == 1,
                coolOn: result.status.tstate == 2,
                override: result.status.override,
                hold: result.status.hold,
                todayCoolRuntimeHours: result.log.today.cool_runtime.hour,
                todayCoolRuntimeMinutes: result.log.today.cool_runtime.minute,
                todayHeatRuntimeHours: result.log.today.heat_runtime.hour,
                todayHeatRuntimeMinutes: result.log.today.heat_runtime.minute
            };

            if (result.status.t_heat) {
                record.targetTemperature = result.status.t_heat;
            }
            else if (result.status.t_cool) {
                record.targetTemperature = result.status.t_cool;
            }

            pool.query('INSERT INTO tstat_log SET ?', record, function (err, res) {
                io.sockets.emit('status', record);
            });
        });
        
    });
    */
}
    /*
    .then(function (currentWeather) {
        tstats.forEach(function (tstat) {
            result = await ThermostatConditions(tstat);
            if (result.errStatus || result.errLog) {
                io.sockets.emit('status', result);
                console.log(JSON.stringify(result));
            }
            else {
                var record = {
                    address: tstat.address,
                    date: new Date(),
                    exteriorTemperature: Number(currentWeather.Temp),
                    interiorTemperature: result.status.temp,
                    targetTemperature: isNaN,
                    weather: currentWeather.Weather,
                    windDir: currentWeather.Windd,
                    windSpeed: currentWeather.Winds,
                    relativeHumidity: currentWeather.Relh,
                    visibility: currentWeather.Visibility,
                    fanOn: result.status.fstate == 1,
                    heatOn: result.status.tstate == 1,
                    coolOn: result.status.tstate == 2,
                    override: result.status.override,
                    hold: result.status.hold,
                    todayCoolRuntimeHours: result.log.today.cool_runtime.hour,
                    todayCoolRuntimeMinutes: result.log.today.cool_runtime.minute,
                    todayHeatRuntimeHours: result.log.today.heat_runtime.hour,
                    todayHeatRuntimeMinutes: result.log.today.heat_runtime.minute
                };

                if (result.status.t_heat) {
                    record.targetTemperature = result.status.t_heat;
                }
                else if (result.status.t_cool) {
                    record.targetTemperature = result.status.t_cool;
                }
                prevTstat = result

                pool.query('INSERT INTO tstat_log SET ?', record, function (err, res) {
                    io.sockets.emit('status', record);
                    return record;
                });
            }
        });
    }, function (err) {
        throw (err)
    });
} */
/*
function Record(tstats, callback) {
    GetNoaaWeather(45.516545019252334, -122.90274007259009).then(function (currentWeather) {
        tstats.forEach(function (tstat) {
            ThermostatConditions(tstat, function (result) {
                if (result.errStatus || result.errLog) {
                    io.sockets.emit('status', result);
                    console.log(JSON.stringify(result));
                }
                else {
                    var record = {
                        address: tstat.address,
                        date: new Date(),
                        exteriorTemperature: Number(currentWeather.Temp),
                        interiorTemperature: result.status.temp,
                        targetTemperature: isNaN,
                        weather: currentWeather.Weather,
                        windDir: currentWeather.Windd,
                        windSpeed: currentWeather.Winds,
                        relativeHumidity: currentWeather.Relh, 
                        visibility: currentWeather.Visibility,
                        fanOn: result.status.fstate == 1,
                        heatOn: result.status.tstate == 1,
                        coolOn: result.status.tstate == 2,
                        override: result.status.override,
                        hold: result.status.hold,
                        todayCoolRuntimeHours: result.log.today.cool_runtime.hour,
                        todayCoolRuntimeMinutes: result.log.today.cool_runtime.minute,
                        todayHeatRuntimeHours: result.log.today.heat_runtime.hour,
                        todayHeatRuntimeMinutes: result.log.today.heat_runtime.minute
                    };

                    if (result.status.t_heat) {
                        record.targetTemperature = result.status.t_heat;
                    }
                    else if (result.status.t_cool) {
                        record.targetTemperature = result.status.t_cool;
                    }
                    prevTstat = result

                    pool.query('INSERT INTO tstat_log SET ?', record, function (err, res) {
                        callback(err, res)
                        io.sockets.emit('status', record);
                    });
                }
            })
        });
    }, function (err) {
        var res;
        callback(err, res);
    });
}
*/

function GetLog(begin, end){
    return new Promise(function (resolve, reject) {
        var connectionString = 'SELECT * FROM `tstat_log` WHERE ';
        if (begin && end) {
            var dateBegin = new Date(begin);
            var dateEnd = new Date(end);
            connectionString += "date between '" + dateBegin.toSQLString() + "' and '" + dateEnd.toSQLString() + "'";
        }
        else if (begin) {
            var dateBegin = new Date(begin);
            connectionString += "date >= '" + dateBegin.toSQLString() + "'";
        }
        else if (end) {
            var dateEnd = new Date(end);
            connectionString += "date <= '" + dateEnd.toSQLString() + "'";
        }
        else {
            connectionString += "1";
        }
        pool.query(connectionString, function (err, res) {
            if (err)
                reject(err);
            resolve(res);
        });
    });
}

http.listen(port, function () {
});
