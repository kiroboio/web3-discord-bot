import { Client } from "discord.js";
import { Server } from "socket.io";
import { REST } from "@discordjs/rest";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
declare type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
declare class Bot {
    private client;
    private io;
    private rest;
    private users;
    constructor({ client, rest, }: {
        client: Client<boolean>;
        rest: REST;
        io: IO;
    });
    setCommands: () => void;
    runClient: () => void;
    createUser: ({ userId, channelId, }: {
        channelId: string;
        userId: string;
    }) => void;
}
declare const bot: Bot;
export { bot };
