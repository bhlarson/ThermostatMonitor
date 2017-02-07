# ThermostatMonitor
Installed location of node projects: /volume1/web/node/BSDBoundaryAnalysis
To Install:
using putty, log into diskstaiton
> cd /volume1/web/node/
> git clone https://github.com/bhlarson/ThermostatMonitor.git
> cd ThermostatMonitor
> npm update    <- this pulls down all the node module dependencies
> ln -s ThermostatMonitor-conf /etc/init/ThermostatMonitor-conf
> chmod -r 777 /etc/init/ThermostatMonitor-conf
Logs:

Debug:


