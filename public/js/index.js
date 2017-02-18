var socket = io();
var svg;

init();
function init() {
    socket.io._timeout = 30000;
    Plot();
}

function StartLog() {
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
    $.get("HeatLossMeasure", { start: start.valueOf(), stop: end.valueOf(), hold: 66 }, function (res) {
        console.log("HeatLossMeasure " + JSON.stringify(res));
    });
}

function HeatLossAbort() {
    $.get("HeatLossAbort", function (res) {
        console.log("HeatLossAbort " + JSON.stringify(res));
    });
}

function ParseData(data) {
    var arrayData = {
        coolOn: [],
        date: [],
        exteriorTemperature: [],
        fanOn: [],
        heatOn: [],
        interiorTemperature: [],
        targetTemperature: [],
        weather: [],
        windDir: [],
        windSpeed: []
    };
    
    for (var i = 0; i < data.length(); i++) {
        var entry = data[i];
        arrayData.date[i] = entry.date;
        arrayData.coolOn[i] = entry.coolOn;
        arrayData.exteriorTemperature[i] = entry.exteriorTemperature;
        arrayData.fanOn[i] = entry.fanOn;
        arrayData.heatOn[i] = entry.heatOn;
        arrayData.interiorTemperature[i] = entry.interiorTemperature;
        arrayData.targetTemperature[i] = entry.targetTemperature;
        arrayData.weather[i] = entry.weather;
        arrayData.windDir[i] = entry.windDir;
        arrayData.windSpeed[i] = entry.windSpeed;
    }
    return arrayData;
}

function UpdatePlot(newData) {
    // set the dimensions and margins of the graph
    var margin = { top: 20, right: 20, bottom: 50, left: 70 };
    var plotRect = document.getElementById('svg_d3jsXY').getBoundingClientRect();
    var width = plotRect.width - margin.left - margin.right;
    var height = plotRect.height - margin.top - margin.bottom;
    var color = d3.scaleOrdinal(d3.schemeCategory10);
    
    var x = d3.scaleTime()
        .domain([new Date(newData[0].date), new Date(newData[newData.length - 1].date)])
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([00, 100])
        .range([height, 0]);
    
    var xAxis = d3.axisTop(x)
    .ticks((width + 2) / (height + 2) * 10)
    .tickSize(height)
    .tickPadding(8 - height);
    
    var yAxis = d3.axisRight(y)
    .ticks(10)
    .tickSize(width)
    .tickPadding(8 - width);
    
    var FnExteriorTemperature = d3.line()
        .x(function (d) {return (x(new Date(d.date)));})
        .y(function (d) { return y(d.exteriorTemperature); });
    
    var FnInteriorTemperature = d3.line()
        .x(function (d) {return (x(new Date(d.date)));})
        .y(function (d) {return y(d.interiorTemperature);});
    
    var FnSetTemperature = d3.line()
        .x(function (d) { return (x(new Date(d.date))); })
        .y(function (d) { return y(d.targetTemperature); });
    
    function zoomed() {
        var transform = d3.zoomTransform(this);
        console.log(JSON.stringify(transform));
        gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
        gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
        tEx.attr("transform", transform);
        tIn.attr("transform", transform);
        tSet.attr("transform", transform);
    }
    
    function resetted() {
        svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity);
    }
    
    var zoom = d3.zoom()
//    .scaleExtent([1, 40])
//    .translateExtent([[-100, -100], [width + 90, height + 100]])
    .on("zoom", zoomed);
    
    // append the svg obgect to the body of the page
    // appends a 'group' element to 'svg'
    // moves the 'group' element to the top left margin
    if (!svg) {
        svg = d3.select("body").append("svg")
        .attr("width", plotRect.width)
        .attr("height", plotRect.height)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .style("pointer-events", "all")
        .call(zoom);
    }
       
    var color = d3.scaleOrdinal(d3.schemeCategory10)
    
    var tEx = svg.append("path")
      .data([newData])
      .style("stroke", color(0))
      .style("fill", "none")
      .attr("d", FnExteriorTemperature)
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var tIn =  svg.append("path")
      .data([newData])
      .style("stroke", color(1))
      .style("fill", "none")
      .attr("d", FnInteriorTemperature);

    var tSet = svg.append("path")
      .data([newData])
      .style("stroke", color(2))
      .style("fill", "none")
      .attr("d", FnSetTemperature);
    
    // text label for the x axis
    svg.append("text")
      .attr("transform",
            "translate(" + (width / 2) + " ," + (height + margin.top + 20) + ")")
      .style("text-anchor", "middle")
      .attr("class", "AxisDisplay")
      .text("Date");

    // text label for the y axis
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("class", "AxisDisplay")
      .text("Termperature");
    
    var gX = svg.append("g")
    .attr("class", "axis axis--x")
    .call(xAxis);
    
    var gY = svg.append("g")
    .attr("class", "axis axis--y")
    .call(yAxis);

    svg.append("g")
      .attr("class", "legendOrdinal")
      .attr("dy", "1em")
      .attr("transform", "translate(20,0)");
    
    var ordinal = d3.scaleOrdinal()
      .domain(["Outside Temperature", "Inside Temperature", "Target Temperature"])
      .range([color(0), color(1), color(2)]);

    var legend = d3.legendColor()
      .cellFilter(function (d) { return d.label !== "e" })
      .scale(ordinal);
    
    svg.select(".legendOrdinal")
      .call(legend);

}

function Plot() {
    var beginDateTime;
    var endDateTime;
    $.get("Plot", { begin: beginDateTime, end: endDateTime }, function (res) {
        UpdatePlot(res);
    });
}

socket.on('status', function (data) {
    var sb = document.getElementById('statusBox');
    sb.append(JSON.stringify(data) + "\n");
    sb.scrollTop = sb.scrollHeight - 1;
});