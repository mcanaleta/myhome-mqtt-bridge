import {
  ClimateTemperatureAcquireMessage,
  ClimateTemperatureAdjustMessage,
  ClimateZoneActuatorMessage,
  ClimateZoneModeMessage,
  ClimateZoneValveMessage,
  OWNClimateDimension,
} from "../openwebnet/climatenormal";
import { Dictionary, isUndefined, some, values } from "lodash";
import { MQTTClimateMode } from "./climatetypes";
import { OWNMonitorMessage } from "../openwebnet/types";
import { ClimateEntity } from "./base";

const ownMode2MQTT = {} as Dictionary<MQTTClimateMode>;

export class ClimateNormalEntity extends ClimateEntity {
  currentTemperature?: number;
  targetTemperature?: number;
  currentMode?: MQTTClimateMode;
  targetMode?: MQTTClimateMode;
  coldValveOn?: boolean;
  heatValveOn?: boolean;
  actuatorsStatus: { [v: string]: boolean } = {};

  configPayload() {
    return {
      temperature_command_topic: `${this.mqttPrefix}/temperature/set`,
      temperature_state_topic: `${this.mqttPrefix}/temperature/state`,
      current_temperature_topic: `${this.mqttPrefix}/current_temperature`,
      mode_command_topic: `${this.mqttPrefix}/mode/set`,
      mode_state_topic: `${this.mqttPrefix}/mode/state`,
      action_topic: `${this.mqttPrefix}/action`,
      precision: 0.1,
      temp_step: 0.5,
      modes: ["off", "heat"],
    };
  }

  async setupMQTT() {
    this.clz.cmd.climate.climateDimensionRequest(
      this.ownId,
      OWNClimateDimension.MEASURES_TEMPERATURE
    );
    this.clz.cmd.climate.climateDimensionRequest(
      this.ownId,
      OWNClimateDimension.SET_POINT_TEMPERATURE
    );
    this.clz.cmd.climate.climateDimensionRequest(
      this.ownId,
      OWNClimateDimension.VALVES_STATUS
    );
    this.clz.cmd.climate.climateDimensionRequest(
      this.ownId,
      OWNClimateDimension.ACTUATOR_STATUS
    );
    this.clz.cmd.climate.climateDimensionRequest(
      this.ownId,
      OWNClimateDimension.SET_TEMPERATURE_WITH_OFFSET
    );
  }

  async handleMQTTMessage(topicSuffix: string, msg: string) {
    console.log("CLIMATE MQTT MESSAGE ", topicSuffix, msg);
    if (topicSuffix == "mode/set") {
      const mode = msg as MQTTClimateMode;
      this.targetMode = mode;
      if (mode == "off") this.clz.cmd.climate.climateOff(this.ownId);
      else {
        this.clz.cmd.climate.climateManualTemperatureAndMode(
          this.ownId,
          this.targetTemperature || 20,
          this.targetMode
        );
      }
    }
    if (topicSuffix == "temperature/set") {
      const temp = parseFloat(msg);
      this.targetTemperature = temp;
      this.clz.cmd.climate.climateManualTemperatureAndMode(
        this.ownId,
        temp,
        this.targetMode!
      );
      this.clz.mqtt.publish(
        `${this.mqttPrefix}/temperature/state`,
        temp.toString()
      );
    }
  }

  async handleOWNMessage(own: OWNMonitorMessage) {
    console.log("CLIMATE OWN MESSAGE", own);
    const mqtt = this.clz.mqtt;
    const prefix = this.mqttPrefix;
    const t = this;
    function updateAction() {
      if (isUndefined(t.actuatorsStatus) || isUndefined(t.currentMode)) {
        return;
      }
      const actuatorOn = some(values(t.actuatorsStatus));
      const action =
        t.currentMode == "off"
          ? "off"
          : actuatorOn
          ? t.currentMode == "heat"
            ? "heating"
            : "cooling"
          : "idle";
      mqtt.publish(`${prefix}/action`, action.toString());
    }

    function updateTargetTemperature(temperature: number) {
      t.targetTemperature = temperature;
      mqtt.publish(
        `${prefix}/temperature/state`,
        t.targetTemperature!.toString()
      );
    }

    function updateTargetMode(mode: MQTTClimateMode) {
      t.targetMode = mode;
      mqtt.publish(`${prefix}/mode/state`, mode);
    }

    //mqtt.publish(`homeassistant/light/${name}/state`, message ? "ON" : "OFF");
    if (own instanceof ClimateZoneModeMessage) {
      this.currentMode = own.mode;
      updateTargetMode((this.targetMode || this.currentMode)!);
      updateAction();
    } else if (own instanceof ClimateTemperatureAcquireMessage) {
      this.currentTemperature = own.temperature;
      mqtt.publish(`${prefix}/current_temperature`, own.temperature.toString());
    } else if (own instanceof ClimateTemperatureAdjustMessage) {
      updateTargetTemperature(own.temperature);
    } else if (own instanceof ClimateZoneValveMessage) {
      this.coldValveOn = own.cold_valve;
      this.heatValveOn = own.heat_valve;
      updateAction();
    } else if (own instanceof ClimateZoneActuatorMessage) {
      this.actuatorsStatus[own.actuator] = own.on;
      updateAction();
    }
  }
}
