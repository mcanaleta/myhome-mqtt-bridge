import {
  connectAndAuthenticate,
  ConnectionManager,
  PKT_START_COMMAND,
  PKT_START_MONITOR,
} from "./connection";
import mqtt from "mqtt";
import { MonitorSession, OWNMonitorMessage } from "./monitor";
import { readFileSync } from "fs";
import { Config } from "./config";
import { Light } from "./classes/light";
import { Climate } from "./classes/climate";
import { Cover } from "./classes/cover";
import _, { forEach, invert, mapValues } from "lodash";
import { EntityClass } from "./classes/base";
import { CommandSession } from "./command";
import yaml from "js-yaml";

export type ClassName = "light" | "climate" | "cover";

async function main() {
  console.log(process.env);
  const configFile = process.env.CONFIG_FILE || "./config/myhome-mqtt.yaml";
  const opts = yaml.load(readFileSync(configFile).toString("utf-8")) as Config;
  const mon = new MonitorSession(opts.myhome);
  const mqtt_client = mqtt.connect(opts.mqtt.url, opts.mqtt.opts);
  const cmd = new CommandSession(opts.myhome);

  const classes: { [className: string]: EntityClass<any> } = {
    light: new Light(cmd, mqtt_client, opts.entities.light),
    climate: new Climate(cmd, mqtt_client, opts.entities.climate),
    cover: new Cover(cmd, mqtt_client, opts.entities.cover),
  };

  forEach(classes, (c) => c.setup());

  mqtt_client.on("connect", function () {
    console.log("connected");
    _(classes).forEach((c) => c.setupMqtt());
    mqtt_client.on("message", (topic, buf: Buffer) => {
      const match = /^homeassistant\/([^\/]*)\/(.*)$/.exec(topic);
      if (match) {
        const msg = buf.toString("utf-8");
        const [_, className, topicSuffix] = match;
        classes[className]?.handleMQTTMessage(topicSuffix, msg);
      }
    });
  });

  mon.on("message", (msg: OWNMonitorMessage) => {
    const cls = classes[msg.className];
    cls.handleOWNMessage(msg);
  });
}

if (require.main === module) {
  main();
}
