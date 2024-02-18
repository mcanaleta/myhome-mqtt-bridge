import { readFileSync } from "fs";
import * as yaml from "js-yaml";
import { Dictionary, forEach } from "lodash";
import * as mqtt from "mqtt";
import { EntityClass } from "./classes/base";
import { Climate } from "./classes/climate";
import { Cover } from "./classes/cover";
import { Light } from "./classes/light";
import { Config } from "./config";
import { CommandSession } from "./openwebnet/commandsession";
import { MonitorSession } from "./openwebnet/monitor";
import { OWNMonitorMessage } from "./openwebnet/types";

async function main() {
  const configFile = process.env.CONFIG_FILE || "./config/myhome-mqtt.yaml";
  const opts = yaml.load(readFileSync(configFile).toString("utf-8")) as Config;
  const mon = new MonitorSession(opts.myhome);
  const mqtt_client = mqtt.connect(opts.mqtt.url, opts.mqtt.opts);
  const cmd = new CommandSession(opts.myhome);

  const classes: Dictionary<EntityClass<any>> = {
    light: new Light(cmd, mqtt_client, opts.entities.light),
    climate: new Climate(cmd, mqtt_client, opts.entities.climate),
    cover: new Cover(cmd, mqtt_client, opts.entities.cover),
  };

  forEach(classes, (c) => c.setup());

  mqtt_client.on("connect", function () {
    console.log("[MQTT] connected");
    Object.values(classes).forEach((c) => c.setupMqtt());
    mqtt_client.on("message", (topic, buf: Buffer) => {
      console.log("[MQTT] RECEIVED", topic, buf.toString("utf-8"));
      const match = /^homeassistant\/([^\/]*)\/(.*)$/.exec(topic);
      if (match) {
        const msg = buf.toString("utf-8");
        const [_, className, topicSuffix] = match;
        classes[className]?.handleMQTTMessage(topicSuffix, msg);
      }
    });
  });
  mqtt_client.on("error", function (err) {
    console.log("[MQTT] error", err);
  });

  mon.on("message", (msg: OWNMonitorMessage) => {
    const cls = classes[msg.className];
    cls.handleOWNMessage(msg);
  });
}

if (require.main === module) {
  main();
}
