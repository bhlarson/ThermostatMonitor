    console.log("Starting ThermostatMonitor on " + process.platform + "\n");

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var schedule = require('node-schedule');
var mysql = require('mysql');
var fetch = require('isomorphic-fetch');
console.log("All External Dependancies Found\n");

var pollPeriodMs = 300000;
var weatherLocation = "Hillsboro, OR";
var thermometerIPAddress = "192.168.1.82";
var pool = mysql.createPool({
    connectionLimit : 10,
    host            : '192.168.1.95',
    user            : 'HomeControl',
//  password        : 'password',
    database        : 'homedb'
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

var port = process.env.PORT || 4454;
app.use(express.static('public'));
app.use(express.static('node_modules/socket.io/node_modules'));

app.get('/', function (req, res) {
    res.sendFile('index.html')
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
        Record(thermometerIPAddress, function (err, res) {
            if (err)
                console.log(err);
        });

        logInterval = setInterval(function () {
            Record(thermometerIPAddress, function (err, res) {
                if (err)
                    console.log(err);
            });
        }, pollPeriodMs);
    }
    catch (err) {
        io.sockets.emit('status', err);
    }
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

function ThermostatConditions(ipAddr, callback) {
    CurrentState(ipAddr, function (eStatus, cStatus) {
        RunLog(ipAddr, function (eLog, rLog) {
            var result = {
                errStatus: eStatus, 
                errLog: eLog,
                status: cStatus,
                log: rLog
            };
            callback(result);
        });
    });
}

function GetWeather(lat, lon) {
    return new Promise(function (resolve, reject) {
        // http://forecast.weather.gov/MapClick.php?FcstType=json&lon=-122.90274007259009&lat=45.516545019252334   
        var str = 'http://forecast.weather.gov/MapClick.php?FcstType=json&lat=' + lat + '&lon=' + lon;
        
        fetch(str).then(function (response) {
            if (response.status >= 400) {
                reject(Error(response.statusText + " " + response.status));
            }
            return response.json();
        }).then(function (weather) {
            resolve(weather.currentobservation);
        });
    });
}

function Record(ipAddr, callback) {
    GetWeather(45.516545019252334, -122.90274007259009).then(function (currentWeather) {
        ThermostatConditions(ipAddr, function (result) {
            if (result.errStatus || result.errLog) {
                io.sockets.emit('status', result);
                console.log(JSON.stringify(result));
            }
            else {
                var record = {
                    date: new Date(), 
                    exteriorTemperature: Number(currentWeather.Temp), 
                    interiorTemperature: result.status.temp, 
                    targetTemperature: isNaN, 
                    weather: currentWeather.Weather, 
                    windDir: currentWeather.Windd, 
                    windSpeed: currentWeather.Winds, 
                    fanOn: result.status.fstate == 1, 
                    heatOn: result.status.tstate == 1, 
                    coolOn: result.status.tstate == 2
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
    }, function (err) {
        var res;
        callback(err, res);
    });
}

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
StartLog();
