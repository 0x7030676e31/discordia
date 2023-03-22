import WebSocket from "ws";
import mapper from "./mapper.js";
import op2 from "./op2.json" assert { type: "json" };
import { log, warn, error } from "./log.js";

const URL = "wss://gateway.discord.gg/?encoding=json&v=10";
const REC_CODES: number[] = [ 1000, 1006, 4000, 4001, 4002, 4003, 4005, 4007, 4008, 4009 ];

type Payload = {
  op: number;
  d: any;
  s: number;
  t: string;
}

export default class Socket {
  private ws?: WebSocket;

  private seq: number = 0;
  private hbInterval: NodeJS.Timeout | null = null;
  private resumeUrl: string = "";
  private sessionID: string = "";
  private sessionsClosed: number = 0;

  private logEvents: boolean = false;

  constructor(token: string) {
    op2.d.token = token;
    this.connect();
  }

  private onClose(code: number, reason: string): void {
    warn(`Connection closed with code ${code} and reason ${reason}`);
    this.sessionsClosed++;

    // If the client has closed more than 5 sessions in a 5 minute period, throw an error
    if (this.sessionsClosed > 5) error("Too many sessions closed in a short period of time");
    setInterval(() => this.sessionsClosed--, 300_000);

    // If the code is in the list of reconnect codes, reconnect
    if (REC_CODES.includes(code)) return void this.reconnect();
  
    // Otherwise, clear the socket and establish a new connection 
    this.clear();
    this.connect();
  }

  private onMessage(msg: any): void {
    const payload = JSON.parse(msg) as Payload;

    if (this.logEvents) log(`Received event ${payload.t}, seq ${payload.s}, op ${payload.op}`);

    switch (payload.op) {
      case 0:
        this.seq = payload.s;
        if (payload.t === "READY") {
          this.resumeUrl = payload.d.resume_gateway_url;
          this.sessionID = payload.d.session_id;
          log("Client is ready");
        }
        
        // Dispatch the event to the mapper
        mapper.register(payload.t, payload.d);
        break;
      
      // Discord is requesting a heartbeat
      case 1:
        this.heartbeat();
        break;

      // Discord is requesting a reconnect
      case 7:
        log("Discord is requesting a reconnect...");
        this.ws?.close();
        this.reconnect();
        break;

      // Discord is requesting a resume or reconnect (payload.d is true for resume)
      case 9:
        log(`Discord is requesting a ${payload.d === true ? "resume" : "reconnect"}...`);

        // If payload.d is true, close the socket and reconnect
        if (payload.d === true) {
          this.reconnect();
          break;
        }

        // Otherwise, clear the socket and establish a new connection
        this.clear();
        this.connect();
        break;

      // Hello, Discord!
      case 10:
        this.hbInterval = setInterval(this.heartbeat.bind(this), +payload.d.heartbeat_interval);
        log("Discord is saying hello");
        break;
    }
  }

  // Send a heartbeat to Discord
  private heartbeat(): void {
    this.ws!.send(JSON.stringify({
      op: 1,
      d: this.seq
    }));
  }

  // Establish a new connection to Discord
  private async connect(): Promise<void> {
    this.ws?.close();
    const ws = this.ws = new WebSocket(URL);
  
    ws.on("open", () => {
      ws.send(JSON.stringify(op2));
      log("Connected to Discord");
    });
    ws.on("close", this.onClose.bind(this));
    ws.on("message", this.onMessage.bind(this));
  }

  // Reconnect to Discord using the resume gateway URL and session ID
  private async reconnect(): Promise<void> {
    const ws = this.ws = new WebSocket(this.resumeUrl);


    ws.on("open", () => {
      ws.send(JSON.stringify({
        op: 6,
        d: {
          token: op2.d.token,
          session_id: this.sessionID,
          seq: this.seq
        },
      }));
      log("Reconnected to Discord");
    
      // Temporarily log events for 15 seconds
      this.logEvents = true;
      setTimeout(() => this.logEvents = false, 15_000);
    });
    ws.on("close", this.onClose.bind(this));
    ws.on("message", this.onMessage.bind(this));
  }

  // Clear the socket data and close the socket
  private clear(): void {
    this.ws?.removeAllListeners();
    this.ws?.close();

    if (this.hbInterval) clearInterval(this.hbInterval);
  
    this.ws = undefined;
    this.hbInterval = null;
    this.seq = 0;
  }
}