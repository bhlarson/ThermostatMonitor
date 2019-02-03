# ThermostatMonitor
Installed location of node projects: /volume1/web/node/ThermostatMonitor
To Install:
using putty, log into diskstaiton
> cd /volume1/web/node/
> git clone https://github.com/bhlarson/ThermostatMonitor.git
> cd ThermostatMonitor
> npm update    <- this pulls down all the node module dependencies

to update:
> cd /volume1/web/node/ThermostatMonitor
> git pull

$ sudo systemctl enable ThermostatMonitor.service
$ sudo systemctl stop ThermostatMonitor.service
$ sudo systemctl start ThermostatMonitor.service
$ sudo systemctl restart ThermostatMonitor.service
$ sudo systemctl disable ThermostatMonitor.service
$ ps -ef | grep CurtainControl
Console out logged to "/var/log/syslog" startup logged to "/var/log/messages" Create mysql datbase:
> sudo kill <node process id>

Schedule start from DSM scheduled tasks
diskstaton->control pannel->task scheduler
create a triggered tasks
In the dialog, use
Task: ThermostatMonitor
Uses: webguest
Event: Boot-up

On task settings, enable send run details email.

Run Command User defined script:
sh /volume1/web/node/ThermostatMonitor/ThermostatMonitor.sh > /volume1/web/node/ThermostatMonitor/console.log

On Settings, enable output recording to the desired location

Logs:

Debug: https://code.visualstudio.com/docs/nodejs/nodejs-debugging
4) 
execute project with debugger
> sudo systemctl stop ThermostatMonitor.service
> node --inspect-brk=0.0.0.0:9229 server.js

Edit devices does not work because retrieved data is date/time.  This is rejected when sent down as a query.


