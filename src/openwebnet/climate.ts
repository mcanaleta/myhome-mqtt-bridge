import { ClassName, OWNMonitorMessage } from "./types";

export abstract class ClimateMessage extends OWNMonitorMessage {
  className: ClassName = "climate";
}

export function temperatureToOWN(temperature: number) {
  return (temperature * 10).toFixed().padStart(4, "0");
}

export function parseTemperature(temp: string) {
  return parseInt(temp) / 10;
}
