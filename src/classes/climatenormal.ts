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
  mode?: MQTTClimateMode;
  //targetMode?: MQTTClimateMode;
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
    console.log("[MQTT] climate message received ", topicSuffix, msg);
    if (topicSuffix == "mode/set") {
      const mode = msg as MQTTClimateMode;
      this.mode = mode;
      if (mode == "off") this.clz.cmd.climate.climateOff(this.ownId);
      else {
        this.clz.cmd.climate.climateManualTemperatureAndMode(
          this.ownId,
          this.targetTemperature || 20,
          this.mode
        );
      }
    }
    if (topicSuffix == "temperature/set") {
      const temp = parseFloat(msg);
      this.targetTemperature = temp;
      this.clz.cmd.climate.climateManualTemperatureAndMode(
        this.ownId,
        temp,
        this.mode!
      );
      this.mqttPublish(`temperature/state`, temp.toString());
    }
  }

  async handleOWNMessage(own: OWNMonitorMessage) {
    console.log("[OWN] climate message received", JSON.stringify(own));
    const t = this;

    //mqtt.publish(`homeassistant/light/${name}/state`, message ? "ON" : "OFF");
    if (own instanceof ClimateZoneModeMessage) {
      if (!own.mode) {
        return;
      }
      this.mode = own.mode;
      this.updateTargetMode();
      this.updateAction();
    } else if (own instanceof ClimateTemperatureAcquireMessage) {
      this.currentTemperature = own.temperature;
      t.mqttPublish(`current_temperature`, own.temperature.toString());
    } else if (own instanceof ClimateTemperatureAdjustMessage) {
      this.targetTemperature = own.temperature!;
      this.updateTargetTemperature();
    } else if (own instanceof ClimateZoneValveMessage) {
      this.coldValveOn = own.cold_valve;
      this.heatValveOn = own.heat_valve;
      this.updateAction();
    } else if (own instanceof ClimateZoneActuatorMessage) {
      this.actuatorsStatus[own.actuator] = own.on;
      this.updateAction();
    }
  }

  updateTargetTemperature() {
    this.mqttPublish(`temperature/state`, this.targetTemperature!.toString());
  }

  updateTargetMode() {
    return this.mqttPublish(`mode/state`, this.mode!);
  }

  updateAction() {
    if (isUndefined(this.actuatorsStatus) || isUndefined(this.mode)) {
      return;
    }
    const actuatorOn = some(values(this.actuatorsStatus));
    const action =
      this.mode == "off"
        ? "off"
        : actuatorOn
        ? this.mode == "heat"
          ? "heating"
          : "cooling"
        : "idle";
    this.mqttPublish(`action`, action.toString());
  }
}
