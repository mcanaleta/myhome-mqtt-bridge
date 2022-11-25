import EventEmitter from "events";
import { Socket } from "net";
import { PKT_ACK } from "./connection";

interface OWNMonitor extends EventEmitter {
  on(
    event: "status",
    listener: (className: string, id: string, on: boolean) => void
  ): this;
}

export function createMonitor(con: Socket) {
  const emiter = new EventEmitter() as OWNMonitor;

  function handleLight(msg: string) {
    const match = /^\*1\*(\d)\*(\d+)##$/.exec(msg);
    if (match) {
      const state = match.at(1);
      const id = match.at(2);
      const on = state == "1";
      emiter.emit("status", "light", id, on);
      return true;
    }
  }

  con.on("data", (data) => {
    con.write(PKT_ACK);
    const msg = data.toString("utf-8");
    console.log("MONITOR RECEIVED", msg);
    handleLight(msg);
  });

  return emiter;
}
