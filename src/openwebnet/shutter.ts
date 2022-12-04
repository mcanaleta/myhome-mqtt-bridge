import { fromPairs } from "lodash";
import { MQTTCoverSet, MQTTCoverState } from "../classes/cover";
import { CommandSession } from "./commandsession";
import { ClassName, OWNMonitorMessage } from "./types";

// https://developer.legrand.com/uploads/2019/12/WHO_2.pdf

const table: [MQTTCoverSet, number][] = [
  ["STOP", 0],
  ["OPEN", 1],
  ["CLOSE", 2],
];

const setMqtt2OWN = fromPairs(table);
const state2MQTT: (MQTTCoverState | undefined)[] = [
  undefined,
  "opening",
  "closing",
];
export class ShutterCommandSession {
  public constructor(public session: CommandSession) {}
  async shutterCommand(id: string, cmd: MQTTCoverSet) {
    await this.session.sendMessage(`*2*${setMqtt2OWN[cmd]}*${id}##`);
  }
}

export function handleCover(msg: string) {
  const match = /^\*2\*(\d)\*(\d+)$/.exec(msg);
  if (match) {
    const statenum = parseInt(match[1]);
    const id = match[2];
    const state = state2MQTT[statenum];
    return new CoverMessage(id, state);
  }
}

export class CoverMessage implements OWNMonitorMessage {
  public constructor(
    public ownId: string,
    public state: MQTTCoverState | undefined
  ) {}
  className: ClassName = "cover";
}
