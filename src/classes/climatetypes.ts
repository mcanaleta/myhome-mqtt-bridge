export type MQTTClimateMode =
  | "auto"
  | "off"
  | "cool"
  | "heat"
  | "dry"
  | "fan_only";

export type MQTTClimateFanMode = "auto" | "low" | "medium" | "high";

export type MQTTClimateAction =
  | "off"
  | "heating"
  | "cooling"
  | "drying"
  | "idle"
  | "fan";
