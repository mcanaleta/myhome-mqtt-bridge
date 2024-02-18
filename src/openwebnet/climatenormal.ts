import { fromPairs } from "lodash";
import { MQTTClimateMode } from "../classes/climatetypes";
import { ClimateMessage, parseTemperature, temperatureToOWN } from "./climate";
import { CommandSession } from "./commandsession";

// https://developer.legrand.com/uploads/2019/12/OWN_Intro_ENG.pdf
// https://developer.legrand.com/uploads/2019/12/WHO_4.pdf

export enum ClimateWhat {
  OFF = "303",
  MANUAL_HEATING = "110",
  PROGRAMMING_HEATING = "111",
  MANUAL_CONDITIONING = "210",
  PROGRAMMING_CONDITIONING = "211",
  MANUAL_GENERIC = "310",
  PROGRAMMING_GENERIC = "311",
}

export enum OWNClimateTemperatureSetMode {
  HEATING = 1,
  CONDITIONING = 2,
  GENERIC = 3,
}

const modes: [string, MQTTClimateMode][] = [
  //  ["4002", "off"],
  ["102", "off"],
  ["303", "off"],
  ["107", "heat"],
  ["108", "heat"],
  ["1", "heat"],
  ["0", "cool"],
];

const modes2MQTT = fromPairs(modes);

export enum OWNClimateDimension {
  MEASURES_TEMPERATURE = "0",
  FANCOIL_SPEED = "11",
  SET_TEMPERATURE_WITH_OFFSET = "12",
  LOCAL_OFFSET = "13",
  SET_POINT_TEMPERATURE = "14",
  VALVES_STATUS = "19",
  ACTUATOR_STATUS = "20",
  SPLIT_CONTROL = "22",
  END_DATE_HOLIDAY = "30",
}

export class ClimateCommandSession {
  public constructor(public session: CommandSession) {}
  async climateOff(id: string) {
    const msg = `*4*${ClimateWhat.OFF}*${id}##`;
    await this.session.sendMessage(msg);
  }

  async climateManualTemperatureAndMode(
    id: string,
    temperature: number,
    mode: MQTTClimateMode
  ) {
    const ownmode =
      mode == "heat"
        ? OWNClimateTemperatureSetMode.HEATING
        : mode == "cool"
        ? OWNClimateTemperatureSetMode.CONDITIONING
        : OWNClimateTemperatureSetMode.GENERIC;
    const t = temperatureToOWN(temperature);
    const msg = `*#4*${id}*#14*${t}*${ownmode}##`;
    await this.session.sendMessage(msg);
  }

  async climateFullStatusRequest(id: string) {
    const msg = `*#4*${id}##`;
    await this.session.sendMessage(msg);
  }

  async climateDimensionRequest(id: string, dimension: OWNClimateDimension) {
    const msg = `*#4*${id}*${dimension}##`;
    await this.session.sendMessage(msg);
  }
}

export class ClimateZoneModeMessage extends ClimateMessage {
  // *4*1*5##
  static expr = /^\*4\*(?<what>\d+)\*(?<zone>\d+)/;
  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone,
    public mode = modes2MQTT[g.what]
  ) {
    super();
  }
}

export class ClimateTemperatureAcquireMessage extends ClimateMessage {
  // *#4*9*0*0205##
  static expr = /^\*#4\*(?<zone>\d+)\*0\*(?<temp>\d+)/;
  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone,
    public temperature = parseTemperature(g.temp)
  ) {
    super();
  }
}
export class ClimateTemperatureAdjustMessage extends ClimateMessage {
  // *#4*5*12*0215*3##

  static expr = /^\*#4\*(?<zone>\d+)\*12\*(?<temp>\d+)\*3/;
  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone,
    public temperature = parseTemperature(g.temp)
  ) {
    super();
  }
}
export class ClimateZoneActuatorMessage extends ClimateMessage {
  //*#4*6#1*#20*0## ->
  static expr = /^\*#4\*(?<zone>\d+)#(?<actuator>\d+)\*20\*(?<value>\d+)/;
  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone,
    public actuator = g.actuator,
    public on = g.value == "1"
  ) {
    super();
  }
}

export class ClimateZoneValveMessage extends ClimateMessage {
  // *#4*5*19*0*0## ->

  static expr =
    /^\*#4\*(?<zone>\d+)\*19\*(?<cold_valve>\d+)\*(?<heat_valve>\d+)/;
  public constructor(
    public g: { [key: string]: string },
    public ownId = g.zone,
    public cold_valve = g.cold_valve == "1",
    public heat_valve = g.heat_valve == "1"
  ) {
    super();
  }
}

export function handleClimate(msg: string) {
  const classes = [
    ClimateZoneModeMessage,
    ClimateTemperatureAcquireMessage,
    ClimateTemperatureAdjustMessage,
    ClimateZoneActuatorMessage,
    ClimateZoneValveMessage,
  ];
  for (const c of classes) {
    const m = c.expr.exec(msg);
    if (m) return new c(m.groups!);
  }
}
