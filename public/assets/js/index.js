var socket = io();
var svg;

init();
function init() {
    socket.io._timeout = 30000;
    
    var begin = new Date();
    var end = new Date();
    $('#PlotStart').val(begin.toISOString().substring(0,19));
    $('#PlotEnd').val(end.toISOString().substring(0,19));
    begin.setDate(end.getDate() - 7);
    Plot(begin, end);
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
    var margin = { top: 10, right: 10, bottom: 35, left: 45 };
    var plotRect = document.getElementById('TemperatureGraph').getBoundingClientRect();
    var width = plotRect.width - margin.left - margin.right;
    var height = plotRect.height - margin.top - margin.bottom;
    var color = d3.scaleOrdinal(d3.schemeCategory10);
    
    var x = d3.scaleTime()
        .domain([new Date(newData[0].date), new Date(newData[newData.length - 1].date)])
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([20, 90])
        .range([height, 0]);
    
    var xAxis = d3.axisBottom(x)
    //.ticks((width + 2) / (height + 2) * 5)
    //.tickSize(height)
    //.tickPadding(8 - height);
    ;
    
    var yAxis = d3.axisLeft(y)
    //.ticks(5)
    //.tickSize(width)
    //.tickPadding(8 - width);
    ;
    
    var FnExteriorTemperature = d3.line()
        .x(function (d) { return (x(new Date(d.date))); })
        .y(function (d) { return y(d.exteriorTemperature); });
    
    var FnInteriorTemperature = d3.line()
        .x(function (d) { return (x(new Date(d.date))); })
        .y(function (d) { return y(d.interiorTemperature); });
    
    var FnSetTemperature = d3.line()
        .x(function (d) { return (x(new Date(d.date))); })
        .y(function (d) { return y(d.targetTemperature); });
    
    function zoomed() {
        var transform = d3.zoomTransform(this);
        gX.call(xAxis.scale(d3.event.transform.rescaleX(x)));
        gY.call(yAxis.scale(d3.event.transform.rescaleY(y)));
        tEx.attr("transform", transform);
        tIn.attr("transform", transform);
        tSet.attr("transform", transform);

        svg.selectAll(".Path")
        .attr("stroke-width", 1 / transform.k);
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
        svg = d3.select("#TemperatureGraph").append("svg")
        .attr("width", plotRect.width)
        .attr("height", plotRect.height)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        //.style("pointer-events", "all")
        .call(zoom);
        
        svg.append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);
        
        // Create invisible rect for mouse tracking
        svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0)
    .attr("id", "mouse-tracker")
    .style("fill", "white");
       
        var color = d3.scaleOrdinal(d3.schemeCategory10)
        
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
        .attr("class", "axis x")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
        
        var gY = svg.append("g")
        .attr("class", "axis y")
        .call(yAxis);
        
        // Create Legend
        svg.append("g")
        .attr("class", "legendOrdinal")
        .attr("dy", "1em")
        .attr("transform", "translate("+ (width-150) +","+ (height-50) +")");
        
        var ordinal = d3.scaleOrdinal()
        .domain(["Outside Temp.", "Inside Temp.", "Target Temp."])
        .range([color(0), color(1), color(2)]);
        
        var legend = d3.legendColor()
        .cellFilter(function (d) { return d.label !== "e" })
        .scale(ordinal);
        
        svg.select(".legendOrdinal")
        .call(legend);
        
        
        // Add data to plot
        var tEx = svg.append("path")
        .data([newData])
        .style("stroke", color(0))
        .style("fill", "none")
        .attr("class", "Path Temp Ext")
        .attr("d", FnExteriorTemperature);
        
        var tIn = svg.append("path")
        .data([newData])
        .style("stroke", color(1))
        .style("fill", "none")
        .attr("class", "Path Temp Int")
        .attr("d", FnInteriorTemperature);
        
        var tSet = svg.append("path")
        .data([newData])
        .style("stroke", color(2))
        .style("fill", "none")
        .attr("class", "Path Temp Set")
        .attr("d", FnSetTemperature);
    }
    else { // Load new data
        svg.select(".Path.Temp.Ext")// change the line
            .data([newData])
            .attr("d", FnExteriorTemperature);
        svg.select(".Path.Temp.Int")// change the line
            .data([newData])
            .attr("d", FnInteriorTemperature);
        svg.select(".Path.Temp.Set")// change the line
            .data([newData])
            .attr("d", FnSetTemperature);
        svg.select(".x.axis")// change the x axis
            .call(xAxis);
        svg.select(".y.axis")// change the y axis
            .call(yAxis);
    }
}

function Plot(begin, end) {
    $.get("Plot", { begin: begin, end: end }, function (res) {
        UpdatePlot(res);
    });
}

socket.on('status', function (data) {
    var sb = document.getElementById('statusBox');
    sb.append(JSON.stringify(data) + "\n");
    sb.scrollTop = sb.scrollHeight - 1;
});