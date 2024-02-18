rm -rf /tmp/myhome-mqtt && 
  rsync -rtv --include='/src/' --include='/config.yaml' --include='/src/**' --include='/Dockerfile' --include='/install.sh' --include='/package.json' --include='/pnpm-lock.yaml' --include='/README.md' --include='/run.sh' --include='/tsconfig.json' --exclude='*' ./ /tmp/myhome-mqtt &&
  ssh root@homeassistant.lan mkdir -p /addons/myhome-mqtt/ &&
  ssh root@homeassistant.lan rm -rf /addons/myhome-mqtt &&
  scp -r /tmp/myhome-mqtt root@homeassistant.lan:/addons &&
  ssh root@homeassistant.lan /addons/myhome-mqtt/install.sh

#ssh root@homeassistant.lan ha addons logs local_myhome_mqtt_bridge
