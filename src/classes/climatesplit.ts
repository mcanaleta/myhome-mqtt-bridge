import { isUndefined } from "lodash";
import { ClimateSplitStatusMessage } from "../openwebnet/climatesplit";
import { OWNMonitorMessage } from "../openwebnet/types";
import { ClimateEntity } from "./base";
import { MQTTClimateFanMode, MQTTClimateMode } from "./climatetypes";

export class ClimateSplitEntity extends ClimateEntity {
  targetTemperature?: number;
  targetMode?: MQTTClimateMode;
  targetFanMode?: MQTTClimateFanMode;

  configPayload() {
    return {
      temperature_command_topic: `${this.mqttPrefix}/temperature/set`,
      temperature_state_topic: `${this.mqttPrefix}/temperature/state`,
      mode_command_topic: `${this.mqttPrefix}/mode/set`,
      mode_state_topic: `${this.mqttPrefix}/mode/state`,
      fan_mode_command_topic: `${this.mqttPrefix}/fan_mode/set`,
      fan_mode_state_topic: `${this.mqttPrefix}/fan_mode/state`,
      fan_modes: ["low", "medium", "high"],
      temp_step: 1,
      modes: ["off", "heat", "cool"],
    };
  }

  async setupMQTT() {
    this.clz.cmd.climateSplit.climateSplitControlRequest(this.ownId);
  }

  async climateSplitSetCmd() {
    if (!this.targetTemperature) {
      this.targetTemperature = this.targetMode == "heat" ? 20 : 27;
    }
    if (!this.targetFanMode) {
      this.targetFanMode = "medium";
    }
    this.clz.cmd.climateSplit.climateSplitControlSet(
      this.ownId,
      this.targetMode!,
      this.targetTemperature!,
      this.targetFanMode!,
      false
    );
  }

  async handleMQTTMessage(topicSuffix: string, msg: string) {
    console.log("CLIMATE MQTT MESSAGE ", topicSuffix, msg);
    if (topicSuffix == "mode/set") {
      const mode = msg as MQTTClimateMode;
      this.targetMode = mode;
      this.climateSplitSetCmd();
    } else if (topicSuffix == "fan_mode/set") {
      const fan_mode = msg as MQTTClimateFanMode;
      this.targetFanMode = fan_mode;
      this.climateSplitSetCmd();
    } else if (topicSuffix == "temperature/set") {
      const temp = parseFloat(msg);
      this.targetTemperature = temp;
      this.climateSplitSetCmd();
    } else if (topicSuffix == "set") {
      const j = JSON.parse(msg);
      this.targetFanMode = j.fan_mode || "medium";
      this.targetMode = j.mode || "off";
      this.targetTemperature = j.temperature || 27;
      this.climateSplitSetCmd();
    }
  }

  async handleOWNMessage(own: OWNMonitorMessage) {
    console.log("CLIMATE OWN MESSAGE", own);
    const t = this;

    function updateTargetTemperature(temperature?: number) {
      if (!temperature) return;
      t.targetTemperature = temperature;
      t.mqttPublish(`temperature/state`, t.targetTemperature!.toString());
    }

    function updateTargetMode(mode: MQTTClimateMode) {
      t.targetMode = mode;
      t.mqttPublish(`mode/state`, mode);
    }

    function updateTargetFanMode(mode: MQTTClimateFanMode) {
      t.targetFanMode = mode;
      t.mqttPublish(`fan_mode/state`, mode);
    }

    if (own instanceof ClimateSplitStatusMessage) {
      updateTargetTemperature(t.targetTemperature || own.temperature);
      if (!isUndefined(own.fanMode)) {
        updateTargetFanMode(own.fanMode);
      }
      updateTargetMode(own.mode);
    }
  }
}
