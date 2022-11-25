import { Socket } from "net";

export function createCommand(con: Socket) {
  const handlers = {
    light: lightCommand,
  } as { [className: string]: (...args: any[]) => Promise<void> };

  async function lightCommand(id: string, on: boolean) {
    const what = on ? "1" : "0";
    await sendMessage(`*1*${what}*${id}##`);
  }

  async function sendMessage(msg: string) {
    console.log("CMD SENDING", msg);
    con.write(msg, (err) => {
      if (err) console.log("CMD SEND ERROR", err);
    });
  }

  async function sendCommand(className: string, id: string, ...args: any[]) {
    await handlers[className](id, ...args);
  }

  con.on("data", (data) => {
    const msg = data.toString("utf-8");
    console.log("CMD RECEIVED", msg);
  });

  return { lightCommand, sendCommand };
}
