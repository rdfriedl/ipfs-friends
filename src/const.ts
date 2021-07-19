import { config } from "dotenv";
config();

export const privateKeyPath = process.env.PRIVATE_KEY_PATH ?? "";
export const publicKeyPath = process.env.PUBLIC_KEY_PATH ?? "";
export const deviceName = process.env.DEVICE_NAME ?? "";
export const photoFolderPath = process.env.FOLDER_PATH ?? "";
export const apiRange = "^0.2.0";

export const ipfsMode = process.env.IPFS_MODE ?? "local";
export const ipfsRepoPath = process.env.IPFS_REPO_PATH ?? "./data/ipfs";
export const ipfsApiUrl = process.env.IPFS_API_URL ?? "http://127.0.0.1";

if (!privateKeyPath) throw new Error("PRIVATE_KEY_PATH not set");
if (!publicKeyPath) throw new Error("PUBLIC_KEY_PATH not set");
if (!deviceName) throw new Error("DEVICE_ID not set");
if (!photoFolderPath) throw new Error("FOLDER_PATH must be set");
