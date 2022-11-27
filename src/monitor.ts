import EventEmitter from "events";
import { find, first } from "lodash";
import { Socket } from "net";
import {
  ConnectionManager,
  ConnectOptions,
  PKT_ACK,
  PKT_START_MONITOR,
} from "./connection";
import { ClassName } from "./main";

interface OWNMonitor extends EventEmitter {
  on(event: "message", listener: (message: OWNMonitorMessage) => void): this;
}

export abstract class OWNMonitorMessage {
  abstract className: ClassName;
  abstract ownId: string;
}
export class LightMessage implements OWNMonitorMessage {
  public constructor(public ownId: string, public on: boolean) {}
  className: ClassName = "light";
}

export class CoverMessage implements OWNMonitorMessage {
  public constructor(public ownId: string, public state: string) {}
  className: ClassName = "cover";
}

export abstract class ClimateMessage extends OWNMonitorMessage {
  className: ClassName = "climate";
}

export type ClimateMode = "off" | "heat" | "auto";
export class ClimateZoneModeMessage extends ClimateMessage {
  public constructor(public ownId: string, public mode: ClimateMode) {
    super();
  }
}

export class ClimateTemperatureAcquireMessage extends ClimateMessage {
  public constructor(public ownId: string, public temperature: number) {
    super();
  }
}
export class ClimateTemperatureAdjustMessage extends ClimateMessage {
  public constructor(public ownId: string, public temperature: number) {
    super();
  }
}
export class ClimateZoneActuatorMessage extends ClimateMessage {
  public constructor(
    public ownId: string,
    public actuator: string,
    public on: boolean
  ) {
    super();
  }
}

export class ClimateZoneValveMessage extends ClimateMessage {
  public constructor(
    public ownId: string,
    public cold_valve: string,
    public heat_valve: string
  ) {
    super();
  }
}

export class MonitorSession extends EventEmitter implements OWNMonitor {
  public conn: ConnectionManager;
  public constructor(public opts: ConnectOptions) {
    super();
    this.conn = new ConnectionManager(opts, PKT_START_MONITOR);
    this.init();
  }
  async init() {
    const con = await this.conn.getSocket();
    con.on("close", () => {
      console.log("monitoring connection closed, reconnecting in 30 secs");
      setTimeout(() => {
        this.init();
      }, 30);
    });
    con.on("data", (data) => {
      con.write(PKT_ACK);
      const packet = data.toString("utf-8");
      //console.log("MONITOR RECEIVED PACKET", packet);
      packet.split("##").forEach((s) => {
        const msg = s + "##";
        if (s == "") return;
        console.log("MONITOR RECEIVED MSG", msg);
        this.handleLight(msg) || this.handleClimate(msg);
      });
    });
  }

  handleLight(msg: string) {
    const match = /^\*1\*(\d)\*(\d+)##$/.exec(msg);
    if (match) {
      const state = match[1];
      const id = match[2];
      const on = state == "1";
      this.emit("message", new LightMessage(id, on));
      return true;
    }
  }

  handleCover(msg: string) {
    const match = /^\*2\*(\d)\*(\d+)##$/.exec(msg);
    if (match) {
      const state = parseInt(match[1]);
      const id = match[2];
      const statestr = ["open", "closed"][state];
      if (statestr) this.emit("message", new CoverMessage(id, statestr));
      return true;
    }
  }

  handleClimate(msg: string) {
    // *#4*where*0*T## - n where zone temperature acquire
    // *4*what*where## - n zone operation mode by cu 110 heat 210 manua cond 310 manual gen
    // *#4*where*11*speed*##  - where speed
    // *#4*where*12*T*3## - temperatore by lcoal offset
    // *#4*where*13*OL## - local zone offset status
    // *#4*where*14*T*3## - local zone point temperature
    function parseTemperature(temp: string) {
      return parseInt(temp) / 10;
    }
    const exprs = [
      // *4*1*5## mode?
      {
        expr: /\*4\*(?<what>\d+)\*(?<zone>\d+)##/,
        func: (g: any) => {
          return new ClimateZoneModeMessage(
            g.zone,
            g.what == "303" ? "off" : g.what == "1" ? "heat" : "auto"
          );
        },
      },

      // *#4*9*0*0205##
      {
        expr: /\*#4\*(?<zone>\d+)\*0\*(?<temperature_acquire>\d+)##/,
        func: (g: any) => {
          return new ClimateTemperatureAcquireMessage(
            g.zone,
            parseTemperature(g.temperature_acquire)
          );
        },
      },
      // *#4*5*12*0215*3##
      {
        expr: /\*#4\*(?<zone>\d+)\*12\*(?<temperature_adjust>\d+)\*3##/,
        func: (g: any) => {
          return new ClimateTemperatureAdjustMessage(
            g.zone,
            parseTemperature(g.temperature_adjust)
          );
        },
      },

      //*#4*6#1*#20*0## ->
      {
        expr: /\*#4\*(?<zone>\d+)#(?<actuator>\d+)\*20\*(?<value>\d+)##/,
        func: (g: any) => {
          return new ClimateZoneActuatorMessage(
            g.zone,
            g.actuator,
            g.value == "1"
          );
        },
      },

      // *#4*5*19*0*0## ->
      {
        expr: /\*#4\*(?<zone>\d+)\*19\*(?<cold_valve>\d+)\*(?<heat_valve>\d+)##/,
        func: (g: any) => {
          return new ClimateZoneValveMessage(
            g.zone,
            g.cold_valve,
            g.heat_valve
          );
        },
      },

      //*4*4002#6*0#1## -> wtf?
      //*#4*6#1*#20*0## ->
    ];
    for (const e of exprs) {
      const m = e.expr.exec(msg);
      if (m) {
        const msg = e.func(m.groups as any);
        this.emit("message", msg);
        return true;
      }
    }
  }
}
