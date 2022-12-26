import { ClimateEntity, Entity, EntityClass } from "./base";
import { ClimateNormalEntity } from "./climatenormal";
import { ClimateSplitEntity } from "./climatesplit";

// https://developer.legrand.com/uploads/2019/12/OWN_Intro_ENG.pdf
// https://developer.legrand.com/uploads/2019/12/WHO_4.pdf

export class Climate extends EntityClass<ClimateEntity> {
  className = "climate";

  subscribeTopicSuffixes = [
    "mode/set",
    "fan_mode/set",
    "temperature/set",
    "set",
  ];

  public createEntity(config: any): ClimateEntity {
    const e = config.where.match(/^7\d\d$/)
      ? new ClimateSplitEntity(this)
      : new ClimateNormalEntity(this);
    return e;
  }
}
