import { Socket } from "net";
import {
  connectAndAuthenticate,
  ConnectionManager,
  ConnectOptions,
  PKT_START_COMMAND,
} from "./connection";
import { ClimateMode } from "./monitor";

const CLIMATE_DIMENSIONS = {
  MEASURES_TEMPERATURE: "0",
  FANCOIL_SPEED: "11",
  SET_TEMPERATURE_WITH_OFFSET: "12",
  LOCAL_OFFSET: "13",
  SET_POINT_TEMPERATURE: "14",
  VALVES_STATUS: "19",
  ACTUATOR_STATUS: "20",
  SPLIT_CONTROL: "22",
  END_DATE_HOLIDAY: "30",
};

export type ClimateDimension = keyof typeof CLIMATE_DIMENSIONS;

const SHUTTER_COMMANDS = {
  STOP: "0",
  UP: "1",
  DOWN: "2",
};

export type ShutterCommand = keyof typeof SHUTTER_COMMANDS;
export class CommandSession {
  public conn: ConnectionManager;
  public constructor(public opts: ConnectOptions) {
    this.conn = new ConnectionManager(opts, PKT_START_COMMAND);
  }
  async lightCommand(id: string, on: boolean) {
    const what = on ? "1" : "0";
    await this.sendMessage(`*1*${what}*${id}##`);
  }

  async climateMode(id: string, mode: "off" | "heating") {
    const modestr = mode == "off" ? "03" : "11";
    // 311 es auto, y no se puede porque hay que enviar junto set temperature mas mode
    const msg = `*4*3${modestr}*${id}##`;
    await this.sendMessage(msg);
  }

  async climateTemperature(id: string, temperature: number, mode: ClimateMode) {
    const modeNum = mode == "heat" ? 1 : 2; //heating
    const t = (temperature * 10).toFixed().padStart(4, "0");
    const msg = `*#4*${id}*#14*${t}*${modeNum}##`;
    await this.sendMessage(msg);
  }

  async climateFullStatusRequest(id: string) {
    const msg = `*#4*${id}##`;
    await this.sendMessage(msg);
  }

  async climateDimensionRequest(id: string, dimension: ClimateDimension) {
    const dimid = CLIMATE_DIMENSIONS[dimension];
    const msg = `*#4*${id}*${dimid}##`;
    await this.sendMessage(msg);
  }

  async shutterCommand(id: string, cmd: ShutterCommand) {
    const what = SHUTTER_COMMANDS[cmd];
    await this.sendMessage(`*2*${what}*${id}##`);
  }

  async sendMessage(msg: string) {
    const con = await this.conn.getSocket();
    console.log("CMD SENDING", msg);
    con.write(msg, (err) => {
      if (err) console.log("CMD SEND ERROR", err);
    });
  }
}
