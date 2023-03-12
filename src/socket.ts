import WebSocket from "ws";
import mapper from "./mapper.js";
import op2 from "./op2.json" assert { type: "json" };

const URL = "wss://gateway.discord.gg/?encoding=json&v=10";

type Payload = {
  op: number;
  d: any;
  s: number;
  t: string;
}

export default class Socket {
  private ws!: WebSocket;

  private seq: number = 0;
  private hbInterval: NodeJS.Timeout | null = null;
  private resumeUrl: string = "";
  private sessionID: string = "";

  constructor(token: string) {
    op2.d.token = token;
    this.connect();
  }

  private onClose(code: number, reason: string): void {
    if (this.hbInterval) clearInterval(this.hbInterval);
    console.log(`Socket closed with code ${code} and reason ${reason}`);
    process.exit(1);
  }

  private onMessage(msg: any): void {
    const payload = JSON.parse(msg) as Payload;

    switch (payload.op) {
      case 0:
        this.seq = payload.s;
        if (payload.t === "READY") {
          this.resumeUrl = payload.d.resume_gateway_url;
          this.sessionID = payload.d.session_id;
        }
        
        mapper.register(payload.t, payload.d);
        break;
        
      case 1:
        this.heartbeat();
        break;

      case 7:
        break;

      case 9:
        break;

      case 10:
        this.hbInterval = setInterval(this.heartbeat.bind(this), +payload.d.heartbeat_interval);
        break;
    }
  }

  private heartbeat(): void {
    this.ws.send(JSON.stringify({
      op: 1,
      d: this.seq
    }));
  }

  private async connect(): Promise<void> {
    const ws = this.ws = new WebSocket(URL);
  
    ws.on("open", () => ws.send(JSON.stringify(op2)));
    ws.on("close", this.onClose.bind(this));
    ws.on("message", this.onMessage.bind(this));
  }
}