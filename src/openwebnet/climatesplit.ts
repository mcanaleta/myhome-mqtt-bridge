import { invert } from "lodash";
import { MQTTClimateFanMode, MQTTClimateMode } from "../classes/climatetypes";
import { ClimateMessage, parseTemperature, temperatureToOWN } from "./climate";
import { CommandSession } from "./commandsession";

// https://developer.legrand.com/uploads/2019/12/OWN_Intro_ENG.pdf
// https://developer.legrand.com/uploads/2019/12/WHO_4.pdf

const mode2MQTT: MQTTClimateMode[] = [
  "off",
  "heat",
  "cool",
  "fan_only",
  "fan_only", //dehumidify
  "auto",
];
const mode2OWN = invert(mode2MQTT);

const velocity2MQTT: (MQTTClimateFanMode | undefined)[] = [
  "auto",
  "low",
  "medium",
  "high",
  undefined, // silent
];

const velocity2OWN = invert(velocity2MQTT);

export class ClimateSplitSession {
  public constructor(public session: CommandSession) {}
  async climateSplitControlRequest(id: string) {
    const msg = `*#4*3#${id.slice(0, 2)}#${id.slice(2, 3)}*22##`;
    await this.session.sendMessage(msg);
  }

  async climateSplitControlSet(
    id: string,
    mode: MQTTClimateMode,
    temperature: number,
    velocity: MQTTClimateFanMode,
    swing: boolean
  ) {
    // "*#4*3#77#8*#22*0**15*15##"
    // "*#4*3#75#8*#22*0**15*15##"
    const zoneStr = `${id.slice(0, 2)}#${id.slice(2, 3)}`;
    if (mode == "off") {
      const msg = `*#4*3#${zoneStr}*#22*0**15*15##`;
      await this.session.sendMessage(msg);
    } else {
      //const parseParam = (cmd: any) => (cmd === null ? "NULL" : cmd);
      const m = mode2OWN[mode];
      const vel = velocity2OWN[velocity] || 0;
      const tempStr = temperature ? temperatureToOWN(temperature) : "NULL";
      const msg = `*#4*3#${zoneStr}*#22*${m}*${tempStr}*${vel}*15##`;
      await this.session.sendMessage(msg);
    }
  }
}

export class ClimateSplitStatusMessage extends ClimateMessage {
  static exprs = [
    // *#4*3#75#8*22*1*0210*2*0##
    /\*#4\*3#(?<zone>\d+)#(?<n>\d)\*22\*(?<mode>\d)\*(?<temp>\d+)\*(?<velocity>\d)\*(?<swing>\d)/,
    // *#4*3#75#8*22*0***##
    /\*#4\*3#(?<zone>\d+)#(?<n>\d)\*22\*0\*\*\*/,
  ];

  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone + g.n,
    public mode = mode2MQTT[parseInt(g.mode)] || "off",
    public temperature = g.temp ? parseTemperature(g.temp) : undefined,
    public fanMode = g.velocity
      ? velocity2MQTT[parseInt(g.velocity)]
      : undefined,
    public swing = g.swing ? g.swinth == "1" : undefined
  ) {
    super();
  }
}

export function handleClimateSplit(msg: string) {
  for (const expr of ClimateSplitStatusMessage.exprs) {
    const m = expr.exec(msg);
    if (m) return new ClimateSplitStatusMessage(m.groups!);
  }
}
