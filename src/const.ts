import { config } from "dotenv";
config();

export const apiUrl = process.env.API_URL ?? "";
export const privateKeyPath = process.env.PRIVATE_KEY_PATH ?? "";
export const publicKeyPath = process.env.PUBLIC_KEY_PATH ?? "";
export const deviceId = process.env.DEVICE_ID ?? "";
export const photoFolderPath = process.env.FOLDER_PATH ?? "";
export const apiRange = "^0.2.0";

if (!privateKeyPath) throw new Error("PRIVATE_KEY_PATH not set");
if (!publicKeyPath) throw new Error("PUBLIC_KEY_PATH not set");
if (!deviceId) throw new Error("DEVICE_ID not set");
if (!photoFolderPath) throw new Error("FOLDER_PATH must be set");
