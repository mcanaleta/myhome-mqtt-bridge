import { CommandSession } from "./commandsession";
import { ClassName, OWNMonitorMessage } from "./types";

// https://developer.legrand.com/documentation/open-web-net-for-myhome/
// https://developer.legrand.com/uploads/2019/12/WHO_1.pdf
export class LightCommandSession {
  public constructor(public session: CommandSession) {}
  async lightCommand(id: string, on: boolean) {
    const what = on ? "1" : "0";
    await this.session.sendMessage(`*1*${what}*${id}##`);
  }
  async lightStatusRequest(id: string) {
    await this.session.sendMessage(`*#1*${id}##`);
  }
}

export class LightMessage implements OWNMonitorMessage {
  public constructor(public ownId: string, public on: boolean) {}
  className: ClassName = "light";
}

export function handleLight(msg: string) {
  const match = /^\*1\*(\d)\*(\d+)$/.exec(msg);
  if (match) {
    const state = match[1];
    const id = match[2];
    const on = state == "1";
    return new LightMessage(id, on);
  }
}
