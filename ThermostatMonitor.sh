#!/bin/sh
printf "\nSet run directory\n"
cd /volume1/web/node/ThermostatMonitor
printf "\nCurrent Directory: "
pwd
printf "\nStart node Thermostat Monitor\n"
/usr/local/bin/node /volume1/web/node/ThermostatMonitor/server.js
