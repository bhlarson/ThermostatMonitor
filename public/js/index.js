
init();
function init() {
}

function StartLog()
{
    $.get("StartLog", function (res) {
        console.log("StartLog " + JSON.stringify(res));
    });
}

function StopLog() {
    $.get("StopLog", function (res) {
        console.log("StopLog " + JSON.stringify(res));
    });
}

function HeatLossMeasure() {
    var start = new Date();
    var end = start;
    end.setHours(start.getHours() + 4);
    $.get("HeatLossMeasure", {start:start.valueOf(),stop:end.valueOf(),hold:66}, function (res) {
        console.log("HeatLossMeasure " + JSON.stringify(res));
    });
}

function HeatLossAbort() {
    $.get("HeatLossAbort", function (res) {
        console.log("HeatLossAbort " + JSON.stringify(res));
    });
}