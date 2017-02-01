console.log("Starting ThermostatMonitor on " + process.platform);

var express = require('express');
var app = express();
var http = require('http').Server(app);
var request = require('request');
var schedule = require('node-schedule');
var mysql = require('mysql');
const noaaWeather = require('noaa-weather');
console.log("All External Dependancies Found");

var weatherLocation = "Hillsboro, OR";
var thermometerIPAddress = "192.168.1.82";

// var pool = mysql.createPool({
//    connectionLimit : 10,
//    host            : '192.168.1.100',
//    user            : 'brad',
//    password        : 'brad',
//    database        : 'homedb'
//});

var pool = mysql.createPool({
    connectionLimit : 10,
    host            : '192.168.1.95',
    user            : 'HomeControl',
    database        : 'homedb'
});

//var rtstat = require('RTS');
//var port = process.env.port || 1337;
//http.createServer(function (req, res) {
//    res.writeHead(200, { 'Content-Type': 'text/plain' });
//    res.end('Hello World\n');
//}).listen(port);

//var tstat = rtstat.tstat('192.168.1.82');

//tstat.sys().then(function (sys) {
//    console.log("tstat.sys: "+JSON.stringify(sys));
//}).catch(function (err) {
//    console.log(err);
//});

//tstat.tstat().then(function (sys) {
//    console.log("tstat.tstat : " + JSON.stringify(sys));
//}).catch(function (err) {
//    console.log(err);
//});

//tstat.datalog().then(function (sys) {
//    console.log("tstat.datalog : " + JSON.stringify(sys));
//}).catch(function (err) {
//    console.log(err);
//});

//tstat.ttemp().then(function (sys) {
//    console.log("tstat.ttemp : " + JSON.stringify(sys));
//}).catch(function (err) {
//    console.log(err);
//}); 

//var reqestStr = 'http://' + ipAddr + '/tstat';
//request(reqestStr + '/ttemp/', function (error, response, body) {
//    if (!error) {
//        console.log(reqestStr + '/ttemp/ succeeded');
//        var tHeat = JSON.parse(body);
//        console.log(body);
//    }
//    else console.log(reqestStr + '/ttemp /' + ' failed: ' + error);
//});

var port = process.env.PORT || 1337;
app.use(express.static('public'));
app.use(express.static('node_modules/jquery-ui-1.12.1'));
app.get('/', function (req, res) {
    res.sendFile('index.html')
});

var logInterval;
app.get('/StartLog', function (req, res) {
    console.log('/StartLog');
    
    Record(thermometerIPAddress, function (err, res) {
        console.log(err);
        console.log(res);
    });
    
    logInterval = setInterval(function (req, res) {
        Record(thermometerIPAddress, function (err, res) {
            console.log(err);
            console.log(res);
        });
    }, 300000, req, res);

    res.send({succeeded:true});
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
            console.log(err);
            SetTempHeat(thermometerIPAddress, hold, function (err, res) {
                console.log('SetTempHeat');
                console.log(err);
                SetRunMode(thermometerIPAddress, RunMode.heat, function (err, res) {
                    console.log('SetRunMode');
                    console.log(err);
                });
            });
        });

    }(hold, stop));
});

app.get('/HeatLossAbort', function (req, res) {
    console.log('/HeatLossAbort');

});

http.listen(port, function () {
});

function CurrentState(ipAddr, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request(reqestStr, function (error, response, body) {
        var state;
        if (!error && response.statusCode == 200) {
            var state = JSON.parse(body);
        }
        callback(error, state);
    });
}

function RunLog(ipAddr, callback)
{
    var reqestStr = 'http://' + ipAddr + '/tstat/datalog/';
    request(reqestStr, function (error, response, body) {
        var log
        if (!error) {
            log = JSON.parse(body);
        }
        callback(error, log);
    });
}

function TargetTemperature(ipAddr, callback){
    var reqestStr = 'http://' + ipAddr + '/tstat/ttemp/';
    request(reqestStr, function (error, response, body) {
        var targetTemperature;
        if (!error) {
            targetTemperature = JSON.parse(body);
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
       function (e, r, body) { callback(e, r.statusMessage)}
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
       function (e, r, body) { callback(e, r.statusMessage) }
    );
}

function SetTempHeat(ipAddr, temperature, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { t_heat: temperature }
    }, 
       function (e, r, body) { callback(r.statusMessage) }
    );
}

function SetTempCool(ipAddr, temperature, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat';
    request({
        url: reqestStr, 
        method: "POST",
        json: { t_cool: temperature }
    }, 
       function (e, r, body) { callback(r.statusMessage) }
    );
}

function TemperatureSwing(ipAddr, callback) {
    var reqestStr = 'http://' + ipAddr + '/tstat/tswing/';
    request(reqestStr, function (error, response, body) {
        var tempSwing;
        if (!error) {
            tempSwing = JSON.parse(body);
        }
        callback(error, tempSwing);
    });
}

function ThermostatConditions(ipAddr, callback) {
    CurrentState(ipAddr, function (eStatus, cStatus) {
        RunLog(ipAddr, function (eLog, rLog) {
            TargetTemperature(ipAddr, function (eTemp, tTemp) {
                var result = {
                    errStatus: eStatus, 
                    errLog: eLog, 
                    status: cStatus,
                    log: rLog,
                    temp: tTemp
                };
                callback(result);
            });
        });
    });
}

function Record(ipAddr, callback){
    noaaWeather(weatherLocation).then(function (strJson) {
        var currentWeather = strJson.currentobservation;
        ThermostatConditions(ipAddr, function (result) {
            var record = {
                date: new Date(), 
                exteriorTemperature: Number(currentWeather.Temp), 
                interiorTemperature: result.status.temp, 
                targetTemperature: 0, 
                weather: currentWeather.Weather, 
                windDir: currentWeather.Windd, 
                windSpeed: currentWeather.Winds, 
                fanOn: result.status.fstate == 1, 
                heatOn: result.status.tstate == 1, 
                coolOn: result.status.tstate == 2
            };
            
            if (result.status.tmode == RunMode.heat) {
                record.targetTemperature = result.temp.t_heat;
            }
            else if(result.status.tmode == RunMode.cool) {
                record.targetTemperature = result.temp.t_cool;
            }
            
            pool.query('INSERT INTO tstat_log SET ?', record, function (err, res) {
                callback(err, res)
            });

        });
    });
}
    /*
    var reqestStr = 'http://'+ ipAddr+'/tstat';
    request(reqestStr, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var tStatus = JSON.parse(body);
            console.log(reqestStr + '  succeeded');
            console.log(body);
        }
        else console.log(reqestStr + ' failed: ' + error);
    
        request(reqestStr + '/datalog/', function (error, response, body) {
            if (!error) {
                var tDatalog = JSON.parse(body);
                console.log(reqestStr + '/datalog/ succeeded');
                console.log(body);
            }
            else console.log(reqestStr + '/datalog/' + ' failed: ' + error);
        
            request(reqestStr + '/ttemp/', function (error, response, body) {
                if (!error) {
                    console.log(reqestStr + '/ttemp/ succeeded');
                    var tHeat = JSON.parse(body);
                    console.log(body);
                }
                else console.log(reqestStr + '/ttemp /' + ' failed: ' + error);
            
                request({
                    url: reqestStr, 
                    method: "POST",
                    json: { tmode: 1 }
                }, 
                     function (e, r, body) {
                    //console.log(e);
                    //console.log(r);
                    console.log(r.request.body + " resturned status " + r.statusMessage);
                });
            });
        });
    });*/
