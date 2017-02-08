# ThermostatMonitor
Installed location of node projects: /volume1/web/node/ThermostatMonitor
To Install:
using putty, log into diskstaiton
> cd /volume1/web/node/
> git clone https://github.com/bhlarson/ThermostatMonitor.git
> cd ThermostatMonitor
> npm update    <- this pulls down all the node module dependencies
> sudo cp /volume1/web/node/ThermostatMonitor/ThermostatMonitor.conf /etc/init/ThermostatMonitor.conf
> sudo chmod 777 /etc/init/ThermostatMonitor.conf
> start ThermostatMonitor.conf
Logs:

Debug:


