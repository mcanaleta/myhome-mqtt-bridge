import { LightMessage } from "../openwebnet/light";
import { OWNMonitorMessage } from "../openwebnet/types";
import { Entity, EntityClass } from "./base";

export class Light extends EntityClass<LightEntity> {
  className = "light";
  subscribeTopicSuffixes = ["set"];

  public createEntity(config: any): LightEntity {
    const e = new LightEntity(this);
    return e;
  }
}

class LightEntity extends Entity {
  async setupMQTT() {
    this.clz.cmd.ligt.lightStatusRequest(this.ownId);
  }

  configPayload() {
    return {
      command_topic: `${this.mqttPrefix}/set`,
      state_topic: `${this.mqttPrefix}/state`,
      config_topic: `${this.mqttPrefix}/config`,
      payload_on: "ON",
      payload_off: "OFF",
    };
  }
  async handleMQTTMessage(topicSuffix: string, msg: string) {
    if (topicSuffix == "set")
      this.clz.cmd.ligt.lightCommand(this.ownId, msg == "ON");
  }

  async handleOWNMessage(own: OWNMonitorMessage) {
    if (own instanceof LightMessage)
      this.mqttPublish("state", own.on ? "ON" : "OFF", true);
  }
}
