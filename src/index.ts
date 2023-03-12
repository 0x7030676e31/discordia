import { config } from "dotenv";
import Socket from "./socket.js";

config();

const { TOKEN } = process.env;
if (!TOKEN) throw new Error("To use this package, you must set a TOKEN environment variable.");

new Socket(TOKEN);