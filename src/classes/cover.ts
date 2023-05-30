import { CoverMessage } from "../openwebnet/shutter";
import { OWNMonitorMessage } from "../openwebnet/types";
import { Entity, EntityClass } from "./base";

export type MQTTCoverSet = "OPEN" | "CLOSE" | "STOP";
export type MQTTCoverState =
  | "opening"
  | "closing"
  | "closed"
  | "open"
  | "stopped";

//https://developer.legrand.com/documentation/open-web-net-for-myhome/
// https://developer.legrand.com/uploads/2019/12/WHO_2.pdf

export class Cover extends EntityClass<CoverEntity> {
  className = "cover";
  subscribeTopicSuffixes = ["set", "set_position"];
  subscribeOnceTopicSuffixes = ["position", "state"];

  public createEntity(config: any): CoverEntity {
    const e = new CoverEntity(this);
    return e;
  }
}

class CoverEntity extends Entity {
  // state
  position?: number;
  direction?: number;

  // config
  fullTransitionTime = 34;

  // target
  targetPos = 0;

  // others
  dirTime = 0;
  dirPos = 0;

  timeoutId: NodeJS.Timeout | undefined;

  configPayload() {
    return {
      command_topic: `${this.mqttPrefix}/set`,
      state_topic: `${this.mqttPrefix}/state`,
      config_topic: `${this.mqttPrefix}/config`,
      position_topic: `${this.mqttPrefix}/position`,
      set_position_topic: `${this.mqttPrefix}/set_position`,
      device_class: "shutter",
      // set_position_template: "{{ position }}",
      // position_template: "{{ value_json.position }}",
      // position_open: 100,
      // position_closed: 0,
      //payload_on: "ON",
      //payload_off: "OFF",
    };
  }

  async setupMQTT() {
    // this.mqttPublish("position", "100");
    // this.mqttPublish("state", "stopped");
  }

  async refreshPosition() {
    // clear timeout in case there is already one
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // variables
    const tp = this.targetPos;
    const dir = this.direction!;

    if (dir !== 0) {
      // update position
      const secs = (Date.now() - this.dirTime) / 1000;
      const perc = secs / this.fullTransitionTime;
      const positionUnClamped = this.dirPos + perc * dir * 100;
      this.position = Math.min(Math.max(positionUnClamped, 0), 100);
      const pos = this.position;

      // figure out if we reached the target position
      if (dir * pos >= dir * tp) {
        this.updateDirection(0);
        if (pos > 0 && pos < 100) {
          this.ownCommand("STOP");
        }
      } else {
        // continue moving
        this.timeoutId = setTimeout(() => this.refreshPosition(), 200);
      }
    }
    this.mqttPublish("position", Math.round(this.position!).toString(), true);
  }

  async updateDirection(dir: number, tp?: number) {
    if (this.position === undefined) {
      this.position = 50;
    }
    if (tp !== undefined) {
      this.targetPos = tp;
    } else {
      this.targetPos = dir == 1 ? 100 : dir == -1 ? 0 : this.position!;
    }
    if (dir !== this.direction) {
      this.dirTime = Date.now();
      this.dirPos = this.position!;
      this.direction = dir;
      const pos = this.position;
      const st =
        pos === 100
          ? "open"
          : pos === 0
          ? "closed"
          : dir == 1
          ? "opening"
          : dir == -1
          ? "closing"
          : "stopped";
      this.mqttPublish("state", st, true);
      if (dir !== 0) {
        this.refreshPosition();
      }
    }
  }

  async handleMQTTMessage(topicSuffix: string, msg: string) {
    console.log(`handleMQTTMessage ${topicSuffix} ${msg}`);
    if (topicSuffix == "set" || topicSuffix == "set_position") {
      const pos = this.position === undefined ? 50 : this.position;
      const tp = msg == "OPEN" ? 100 : msg == "CLOSE" ? 0 : parseInt(msg);
      const dir = tp > pos ? 1 : tp < pos ? -1 : 0;
      const cmd = dir == 1 ? "OPEN" : dir == -1 ? "CLOSE" : "STOP";
      this.ownCommand(cmd);
      this.updateDirection(dir, tp);
    } else if (topicSuffix == "position") {
      if (this.position === undefined) {
        this.position = parseInt(msg);
      }
    } else if (topicSuffix == "state") {
      if (this.direction === undefined) {
        const dir = msg == "opening" ? 1 : msg == "closing" ? -1 : 0;
        if (this.position !== undefined) {
          this.updateDirection(dir);
          this.refreshPosition();
        }
      }
    }
  }

  async handleOWNMessage(msg: OWNMonitorMessage) {
    const secondsEnlapsed = (Date.now() - this.dirTime) / 500;
    // hack to ignore messages consequence of our action
    if (secondsEnlapsed > 2) {
      console.log(`OWN Cover message ${JSON.stringify(msg)}`);
      if (msg instanceof CoverMessage && msg.state) {
        if (msg.state == "opening") {
          this.targetPos;
          this.updateDirection(1);
        } else if (msg.state == "closing") {
          this.updateDirection(-1);
        } else {
          this.updateDirection(0);
        }
      }
    }
  }

  async ownCommand(cmd: MQTTCoverSet) {
    this.clz.cmd.shutter.shutterCommand(this.ownId, cmd);
  }
}
