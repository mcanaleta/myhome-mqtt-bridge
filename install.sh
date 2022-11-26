. /etc/profile.d/homeassistant.sh
echo 'store reload'
ha store reload
echo 'update'
ha addons install local_myhome_mqtt_bridge
echo 'update'
ha addons update local_myhome_mqtt_bridge
echo 'rebuild'
ha addons rebuild local_myhome_mqtt_bridge
echo 'restart'
ha addons restart local_myhome_mqtt_bridge
echo 'logs'
ha addons logs local_myhome_mqtt_bridge
