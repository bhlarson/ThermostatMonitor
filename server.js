console.log("Starting ThermostatMonitor on " + process.platform);

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var request = require('request');
var schedule = require('node-schedule');
var mysql = require('mysql');
const noaaWeather = require('noaa-weather');
console.log("All External Dependancies Found");

var weatherLocation = "Hillsboro, OR";
var thermometerIPAddress = "192.168.1.82";
var pool = mysql.createPool({
    connectionLimit : 10,
    host            : '192.168.1.95',
    user            : 'HomeControl',
//  password        : 'password',
    database        : 'homedb'
});

var port = process.env.PORT || 1337;
app.use(express.static('public'));
app.use(express.static('node_modules/socket.io/node_modules'));
app.get('/', function (req, res) {
    res.sendFile('index.html')
});

var logInterval;
var prevLog;
var pervStatus;
app.get('/StartLog', function (req, res) {
    console.log('/StartLog ');
    if (logInterval) clearInterval(logInterval);
    
    Record(thermometerIPAddress, function (err, res) {
        console.log(err);
        console.log(res);
    });
    
    try {
        logInterval = setInterval(function (req, res) {
            Record(thermometerIPAddress, function (err, res) {
                console.log(err);
                console.log(res);
            });
        }, 60000, req, res);
    }
    catch (err) {
        io.sockets.emit('status', err);
    }
    
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


http.listen(port, function () {
});

function CurrentState(ipAddr, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request(reqestStr, function (error, response, body) {
        var state;
        if (!error && response.statusCode == 200) {
            state = JSON.parse(body);
        }
        if (state.temp > 0 && (state.t_heat > 0 || state.t_cool > 0)) {
            callback(error, state);
        }
        else { // 2nd try
            request(reqestStr, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    state = JSON.parse(body);
                }
                if (error || !state || state.temp <= 0 || !(state.t_heat > 0 || state.t_cool > 0)) {
                    error = reqestStr + " failed status " +response.statusMessage+ " error " + error;
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
                if (error || !log ) {
                    error = reqestStr + " failed status " + response.statusMessage + " error " + error;
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

function Record(ipAddr, callback){
    noaaWeather(weatherLocation).then(function (strJson) {
        var currentWeather;
        if(strJson && strJson.currentobservation)
            currentWeather = strJson.currentobservation;

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
                prevLog =result.log
                
                pool.query('INSERT INTO tstat_log SET ?', record, function (err, res) {
                    callback(err, res)
                    io.sockets.emit('status', record);
                });
            }

        });
    });
}
