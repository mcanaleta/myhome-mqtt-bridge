import { Socket } from "net";
import { ClimateSplitSession } from "./climatesplit";
import { ClimateCommandSession } from "./climatenormal";
import {
  connectAndAuthenticate,
  ConnectOptions,
  PKT_START_COMMAND,
} from "./connection";
import { LightCommandSession } from "./light";
import { ShutterCommandSession } from "./shutter";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// https://developer.legrand.com/uploads/2019/12/OWN_Intro_ENG.pdf

export class CommandSession {
  con?: Socket;
  connecting = false;

  public constructor(public opts: ConnectOptions) {}

  public ligt = new LightCommandSession(this);
  public shutter = new ShutterCommandSession(this);
  public climate = new ClimateCommandSession(this);
  public climateSplit = new ClimateSplitSession(this);

  async sendMessage(msg: string) {
    const con = await this.getSocket();
    console.log("[OWN] sending CMD", msg);
    con.write(msg, (err) => {
      if (err) console.log("[OWN] sending CMD error", err);
    });
  }

  async getSocket() {
    if (!this.con) {
      if (!this.connecting) {
        console.log("[OWN] COMMAND SESSION CONNECTING");
        this.connecting = true;
        const con = await connectAndAuthenticate(this.opts, PKT_START_COMMAND);
        con.on("close", () => {
          console.log("[OWN] COMMAND SESSION CLOSED");
          this.con = undefined;
        });
        con.on("data", (data) => {
          const packet = data.toString("utf-8");
          console.log("[OWN] COMMAND SESSION RECEIVED MSG", packet);
        });
        this.con = con;
        this.connecting = false;
      } else {
        let counter = 0;
        while (!this.con) {
          await sleep(100);
          counter++;
          if (counter == 100) {
            throw "timeout";
          }
        }
      }
    }

    return this.con!;
  }
}
