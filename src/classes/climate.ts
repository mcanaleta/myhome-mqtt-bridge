import _, { isUndefined, some, values } from "lodash";
import { MqttClient } from "mqtt";
import { CommandSession } from "../command";
import {
  ClimateMode,
  ClimateTemperatureAcquireMessage,
  ClimateTemperatureAdjustMessage,
  ClimateZoneActuatorMessage,
  ClimateZoneModeMessage,
  ClimateZoneValveMessage,
  OWNMonitorMessage,
} from "../monitor";
import { Entity, EntityClass } from "./base";

// https://developer.legrand.com/uploads/2019/12/OWN_Intro_ENG.pdf
//https://developer.legrand.com/uploads/2019/12/WHO_4.pdf
export class Climate extends EntityClass<ClimateEntity> {
  className = "climate";

  subscribeTopicSuffixes = ["mode/set", "temperature/set"];

  public createEntity(config: any): ClimateEntity {
    const e = new ClimateEntity(this);
    return e;
  }
}

class ClimateEntity extends Entity {
  currentTemperature?: number;
  targetTemperature?: number;
  currentMode?: ClimateMode;
  targetMode?: ClimateMode;
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
    this.clz.cmd.climateDimensionRequest(this.ownId, "MEASURES_TEMPERATURE");
    this.clz.cmd.climateDimensionRequest(this.ownId, "SET_POINT_TEMPERATURE");
    this.clz.cmd.climateDimensionRequest(this.ownId, "VALVES_STATUS");
    this.clz.cmd.climateDimensionRequest(this.ownId, "ACTUATOR_STATUS");
    this.clz.cmd.climateDimensionRequest(
      this.ownId,
      "SET_TEMPERATURE_WITH_OFFSET"
    );
  }

  async handleMQTTMessage(topicSuffix: string, msg: string) {
    console.log("CLIMATE MQTT MESSAGE ", topicSuffix, msg);
    if (topicSuffix == "mode/set") {
      const mode = msg as ClimateMode;
      this.targetMode = mode;
      if (mode == "off") this.clz.cmd.climateMode(this.ownId, "off");
      else {
        this.clz.cmd.climateTemperature(
          this.ownId,
          this.targetTemperature || 20,
          this.targetMode
        );
      }
    }
    if (topicSuffix == "temperature/set") {
      const temp = parseFloat(msg);
      this.targetTemperature = temp;
      this.clz.cmd.climateTemperature(this.ownId, temp, this.targetMode!);
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

    //mqtt.publish(`homeassistant/light/${name}/state`, message ? "ON" : "OFF");
    if (own instanceof ClimateZoneModeMessage) {
      this.currentMode = own.mode;
      this.targetMode = this.targetMode || this.currentMode;
      mqtt.publish(`${prefix}/mode/state`, own.mode);
      updateAction();
    } else if (own instanceof ClimateTemperatureAcquireMessage) {
      this.currentTemperature = own.temperature;
      mqtt.publish(`${prefix}/current_temperature`, own.temperature.toString());
    } else if (own instanceof ClimateTemperatureAdjustMessage) {
      this.targetTemperature = own.temperature;
      mqtt.publish(`${prefix}/temperature/state`, own.temperature.toString());
    } else if (own instanceof ClimateZoneValveMessage) {
      this.coldValveOn = own.cold_valve == "1";
      this.heatValveOn = own.heat_valve == "1";
      updateAction();
    } else if (own instanceof ClimateZoneActuatorMessage) {
      this.actuatorsStatus[own.actuator] = own.on;
      updateAction();
    }
  }
}