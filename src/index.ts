import { config } from "dotenv";
import Socket from "./socket.js";
import { error } from "./log.js";

config();

const { TOKEN } = process.env;
if (!TOKEN) error("No token provided");

new Socket(TOKEN);