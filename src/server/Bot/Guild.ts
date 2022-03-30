import Keyv from "keyv";
import { User } from "./User";

export class Guild {
  public usersDb: Keyv;
  public rolesDb: Keyv;
  public guildId: string;
  public users: { [key: string]: User | undefined } = {};
  constructor({
    rolesDb,
    usersDb,
    guildId,
  }: {
    rolesDb: Keyv;
    usersDb: Keyv;
    guildId: string;
  }) {
    this.rolesDb = rolesDb;
    this.usersDb = usersDb;
    this.guildId = guildId;
  }

  public setUser = async ({
    user,
    userId
  }: {
    user: User 
    userId: string
  }) => {
    this.users[userId] = user
  };
}
