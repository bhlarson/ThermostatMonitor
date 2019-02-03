var tstats;

function ValidURL(str) {
    var pattern = new RegExp('^(https?:\/\/)?' + // protocol
        '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|' + // domain name
        '((\d{1,3}\.){3}\d{1,3}))' + // OR ip (v4) address
        '(\:\d+)?(\/[-a-z\d%_.~+]*)*' + // port and path
        '(\?[;&a-z\d%_.~+=-]*)?' + // query string
        '(\#[-a-z\d_]*)?$', 'i'); // fragment locater
    if (!pattern.test(str)) {
        return false;
    } else {
        return true;
    }
}

function ValidIPaddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(myForm.emailAddr.value)) {
        return (true)
    }
    return (false)
}

function AppendDevice(row, tstat, newDevice)
{
    const iName = 0;
    const iDesc = 1;
    const iAddr = 2;
    const iInstall = 3;
    const iType = 4;
    const iControl = 5;
    
    while (row.cells && row.cells.length > 0) {
        row.deleteCell(row.cells.length-1);
    }

    if (typeof tstat === 'undefined' || tstat === null) {
        tstat = { name: '', description: '', address: '', install: Date() , type:0};
    }

    var name = document.createElement('input');
    name.type = "text";
    name.value = tstat.name;
    var cell = row.insertCell(iName);
    cell.appendChild(name);

    var desc = document.createElement('input');
    desc.type = "text";
    desc.value = tstat.description;
    var cell = row.insertCell(iDesc);
    cell.appendChild(desc);

    var addr = document.createElement('input');
    addr.type = "text";
    addr.value = tstat.address;
    var cell = row.insertCell(iAddr);
    cell.appendChild(addr);

    var install = document.createElement('input');
    install.type = "date";
    if ((typeof tstat.install === 'undefined' || tstat.install === null)) {
        var now = new Date();
        install.value = now.toISOString().substr(0, 10);
    }
    else {
        install.value = tstat.install.substr(0, 10);
    }
    
    var cell = row.insertCell(iInstall);
    cell.appendChild(install);
       
    //Create and append select list
    var type = document.createElement("select");   
    var typeOptions = ['radiothermostat', 'nest', 'ecobee']; //Create array of options to be added
    //Create and append the options
    for (var i = 0; i < typeOptions.length; i++) {
        var option = document.createElement("option");
        option.value = typeOptions[i];
        option.text = typeOptions[i];
        type.appendChild(option);
    }
    if ((typeof tstat.type === 'undefined' || tstat.type === null)) {
        type.value = typeOptions[0];
    }
    else {
        type.value = tstat.type;
    }
    var cell = row.insertCell(iType);
    cell.appendChild(type);
 
    var cell = row.insertCell(iControl);
    if (!(typeof newDevice === 'undefined' || newDevice === null)) {
        var add = document.createElement('input');
        add.type = "button";
        add.value = "Add";
        add.onclick = function () {
            
            var update = {
                name: name.value,
                description: desc.value,
                address: addr.value,
                install: install.value,
                type: type.value
            };
            
            $.get("AddDevice", { update: update }, function (err) {
                if (err) {
                    console.log(Date() + " AddDevice failed:");
                    console.log(err);
                }
                else {
                    AppendDevice(row, update);
                }
            });
        };
        cell.appendChild(add);
    }
    else {
        var update = document.createElement('input');
        update.type = "button";
        update.value = "Update";
        update.onclick = function () {
            
            var update = {
                name: name.value,
                description: desc.value,
                address: addr.value,
                install: install.value,
                type: type.value
            };
            
            $.get("UpdateDevice", { previous: tstat, update: update }, function (err) {
                console.log("UpdateDevice err:" + err);
            });
        };
        cell.appendChild(update);
    }
    var remove = document.createElement('input');
    remove.type = "button";
    remove.value = "Delete";
    remove.onclick = function () {
        
        var remove = {
            address: addr.value,
        };
        
        $.get("RemoveDevice", remove, function (err) {
            if (err) {
                console.log(Date() + " RemoveDevice failed:");
                console.log(err);
            }
            else {
                var table = document.getElementById("deviceTable");
               table.deleteRow(row.rowIndex);
            }
        });
    };
    cell.appendChild(remove);
}

function GetDeviceNames(devices)
{
    var names = [];
    if (devices && devices.constructor === Array) {
        devices.forEach(function (device, i) {
            names[i] = device.name;
        });
    }
    return names;
}

$(function () {
    $.get("GetDevices", function (tstatDevices) {
        tstats = tstatDevices;

        var deviceTable = document.getElementById("deviceTable");
        if (tstats && tstats.constructor === Array) {
            tstats.forEach(function (tstat, i) {
                var row = deviceTable.insertRow(i + 1);
                AppendDevice(row, tstat);
            });
        }
    });
});

function AddDevice(){
    $('#deviceTable tbody').append($("#deviceTable tbody tr:last").clone());
    var table = document.getElementById("deviceTable");
    var row = table.insertRow(table.rows.length);
    AppendDevice(row, null, true);
}