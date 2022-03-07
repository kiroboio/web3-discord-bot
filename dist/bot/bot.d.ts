import { Client } from "discord.js";
import { Server } from "socket.io";
import { REST } from "@discordjs/rest";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
declare type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
declare class Bot {
    private client;
    private io;
    private socket;
    private rest;
    private users;
    constructor({ client, io, rest, }: {
        client: Client<boolean>;
        io: IO;
        rest: REST;
    });
    setCommands: () => void;
    runClient: () => void;
    runSocket: () => void;
    createUser: ({ userId, channelId, }: {
        channelId: string;
        userId: string;
    }) => void;
}
declare const bot: Bot;
export { bot };
