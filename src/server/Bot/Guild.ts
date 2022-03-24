import Keyv from "keyv";

export class Guild {
  public usersDb: Keyv;
  public rolesDb: Keyv;
  public guildId: string;

  constructor({
    rolesDb,
    usersDb,
    guildId
  }: {
    rolesDb: Keyv;
    usersDb: Keyv;
    guildId: string
  }) {
    this.rolesDb = rolesDb;
    this.usersDb = usersDb;
    this.guildId = guildId;
  }
}