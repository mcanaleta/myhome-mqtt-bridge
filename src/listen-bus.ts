import { readFileSync } from "fs";
import yaml from "js-yaml";
import { ConnectOptions } from "./openwebnet/connection";
import { MonitorSession } from "./openwebnet/monitor";
import { OWNMonitorMessage } from "./openwebnet/types";

type ListenBusConfig = ConnectOptions | { myhome: ConnectOptions };

function formatMessage(msg: OWNMonitorMessage) {
  return JSON.stringify(msg);
}

function readConnectOptions(configFile: string) {
  const config = yaml.load(readFileSync(configFile).toString("utf-8")) as ListenBusConfig;
  const opts = "myhome" in config ? config.myhome : config;

  if (!opts.host || !opts.port || !opts.password) {
    throw new Error("Config must include host, port, and password");
  }

  return opts;
}

async function main() {
  const configFile = process.env.CONFIG_FILE || "./config/listen-bus.yaml";
  const opts = readConnectOptions(configFile);

  console.log(`listening to MyHome bus on ${opts.host}:${opts.port}`);
  console.log("press Ctrl+C to stop");

  const monitor = new MonitorSession(opts);
  monitor.on("message", (msg) => {
    console.log(formatMessage(msg));
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
