import { connect, PKT_START_COMMAND, PKT_START_MONITOR } from "./connection";
import mqtt from "mqtt";
import { createMonitor } from "./monitor";
import { readFileSync } from "fs";
import { Config } from "./config";
import { light } from "./classes/light";
import _, { invert, mapValues } from "lodash";
import { EntityClass } from "./classes/base";
import { createCommand } from "./command";

async function main() {
  console.log(process.env);
  const configFile = process.env.CONFIG_FILE || "./config/myhome-mqtt.json";
  const opts = JSON.parse(readFileSync(configFile).toString("utf-8")) as Config;
  const id2Name = mapValues(opts.entities, invert) as {
    [className: string]: { [id: string]: string };
  };
  const command_conn = await connect(opts.myhome, PKT_START_COMMAND);
  const monitor_conn = await connect(opts.myhome, PKT_START_MONITOR);
  const mon = createMonitor(monitor_conn);
  const mqtt_client = mqtt.connect(opts.mqtt.url, opts.mqtt.opts);
  const cmd = createCommand(command_conn);

  const classes: { [className: string]: EntityClass } = {
    light,
  };

  mqtt_client.on("connect", function () {
    console.log("connected");
    _(opts.entities).forEach((entities, className) => {
      _(entities).forEach((entity, name) => {
        const prefix = `homeassistant/light/${name}`;
        const topics = {
          command_topic: `${prefix}/set`,
          state_topic: `${prefix}/state`,
          config_topic: `${prefix}/config`,
        };
        const extraPayload = classes[className].configPayload;
        const configMessage = { name, ...topics, ...extraPayload };
        mqtt_client.publish(topics.config_topic, JSON.stringify(configMessage));
        mqtt_client.subscribe(topics.command_topic);
        //mqtt_client.subscribe(topics.state_topic);
      });
    });
    mqtt_client.on("message", (topic, buf: Buffer) => {
      const match = /homeassistant\/(.*)\/(.*)\/(.*)/.exec(topic);
      if (match) {
        const msg = buf.toString("utf-8");
        const [_, className, name, what] = match;
        const id = (opts.entities as any)[className][name];
        const clz = classes[className];
        if (what == "set") {
          cmd.sendCommand(className, id, ...clz.msg2MyHomeCmdArgs(msg));
        } else if (what == "state") {
          // weird
        }
      }
    });
  });

  mon.on("status", (className, id, payload) => {
    const cls = classes[className];
    const name = id2Name[className][id];
    mqtt_client.publish(
      `homeassistant/${className}/${name}/state`,
      cls.stateMessage(payload)
    );
  });
}

if (require.main === module) {
  main();
}
