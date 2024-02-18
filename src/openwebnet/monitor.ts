import EventEmitter = require("events");
import { handleClimate } from "./climatenormal";
import { handleClimateSplit } from "./climatesplit";
import {
  connectAndAuthenticate,
  ConnectOptions,
  PKT_ACK,
  PKT_START_MONITOR,
} from "./connection";
import { handleLight } from "./light";
import { handleCover } from "./shutter";
import { OWNMonitorMessage } from "./types";

interface OWNMonitor extends EventEmitter {
  on(event: "message", listener: (message: OWNMonitorMessage) => void): this;
}

export class MonitorSession extends EventEmitter implements OWNMonitor {
  public constructor(public opts: ConnectOptions) {
    super();
    this.init();
  }
  async init() {
    const con = await connectAndAuthenticate(this.opts, PKT_START_MONITOR);

    con.on("close", () => {
      console.log(
        "[OWN] monitoring connection closed, reconnecting in 30 secs"
      );
      setTimeout(() => {
        this.init();
      }, 30);
    });
    con.on("data", (data) => {
      con.write(PKT_ACK);
      const packet = data.toString("utf-8");
      //console.log("MONITOR RECEIVED PACKET", packet);
      packet.split("##").forEach((s) => {
        if (s == "") return;
        console.log("[OWN] MONITOR received", s + "##");
        const msg =
          handleLight(s) ||
          handleClimate(s) ||
          handleClimateSplit(s) ||
          handleCover(s);
        if (msg) {
          this.emit("message", msg);
        } else {
          console.log("[OWN] MONITOR unknown msg", s);
        }
      });
    });
  }
}
