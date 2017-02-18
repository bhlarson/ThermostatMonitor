# ThermostatMonitor
Installed location of node projects: /volume1/web/node/ThermostatMonitor
To Install:
using putty, log into diskstaiton
> cd /volume1/web/node/
> git clone https://github.com/bhlarson/ThermostatMonitor.git
> cd ThermostatMonitor
> npm update    <- this pulls down all the node module dependencies

Schedule start from DSM scheduled tasks
diskstaton->control pannel->task scheduler
craete a triggered tasks
In the dialog, use
Task: ThermostatMonitor
Uses: webguest
Event: Boot-up

On task settings, enable send run details email.

Run Command User defined script:
sh /volume1/web/node/ThermostatMonitor/ThermostatMonitor.sh

On Settings, enable output recording to the desired location

Logs:

Debug:


