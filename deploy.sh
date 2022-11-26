rm -rf /tmp/deploy-myhome-mqtt && 
  rsync --exclude=dist --exclude=.git --exclude=.vscode --exclude=config --exclude=ref --exclude=node_modules -rtv ./ /tmp/deploy-myhome-mqtt &&
  ssh root@homeassistant.lan mkdir -p /addons/myhome-mqtt/ &&
  ssh root@homeassistant.lan rm -rf /addons/myhome-mqtt &&
  scp -r /tmp/deploy-myhome-mqtt/ root@homeassistant.lan:/addons/myhome-mqtt/ &&
  ssh root@homeassistant.lan /addons/myhome-mqtt/install.sh

ssh root@homeassistant.lan ha addons logs local_myhome_mqtt_bridge
