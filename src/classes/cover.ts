import { CoverMessage } from "../openwebnet/shutter";
import { OWNMonitorMessage } from "../openwebnet/types";
import { Entity, EntityClass } from "./base";

export type MQTTCoverSet = "OPEN" | "CLOSE" | "STOP";
export type MQTTCoverState = "opening" | "closing" | "closed" | "open";

//https://developer.legrand.com/documentation/open-web-net-for-myhome/
// https://developer.legrand.com/uploads/2019/12/WHO_2.pdf

export class Cover extends EntityClass<CoverEntity> {
  className = "cover";
  subscribeTopicSuffixes = ["set"];

  public createEntity(config: any): CoverEntity {
    const e = new CoverEntity(this);
    return e;
  }
}

class CoverEntity extends Entity {
  configPayload() {
    return {
      command_topic: `${this.mqttPrefix}/set`,
      state_topic: `${this.mqttPrefix}/state`,
      config_topic: `${this.mqttPrefix}/config`,
      //payload_on: "ON",
      //payload_off: "OFF",
    };
  }
  async handleMQTTMessage(topicSuffix: string, msg: string) {
    if (topicSuffix == "set")
      this.clz.cmd.shutter.shutterCommand(this.ownId, msg as MQTTCoverSet);
    //this.clz.cmd.lightCommand(this.ownId, msg == "ON");
  }

  async handleOWNMessage(msg: OWNMonitorMessage) {
    if (msg instanceof CoverMessage) {
      if (msg.state) this.mqttPublish(`state`, msg.state);
    }
  }
}
