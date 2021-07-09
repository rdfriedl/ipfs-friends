"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoFolderPath = exports.deviceId = exports.publicKeyPath = exports.privateKeyPath = exports.apiUrl = void 0;
const dotenv_1 = require("dotenv");
dotenv_1.config();
exports.apiUrl = process.env.API_URL ?? "";
exports.privateKeyPath = process.env.PRIVATE_KEY_PATH ?? "";
exports.publicKeyPath = process.env.PUBLIC_KEY_PATH ?? "";
exports.deviceId = process.env.DEVICE_ID ?? "";
exports.photoFolderPath = process.env.FOLDER_PATH ?? "";
if (!exports.privateKeyPath)
    throw new Error("PRIVATE_KEY_PATH not set");
if (!exports.publicKeyPath)
    throw new Error("PUBLIC_KEY_PATH not set");
if (!exports.deviceId)
    throw new Error("DEVICE_ID not set");
if (!exports.photoFolderPath)
    throw new Error("FOLDER_PATH must be set");
//# sourceMappingURL=const.js.map