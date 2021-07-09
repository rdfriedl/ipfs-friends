"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrivaryPublicUser = exports.getPublicKey = exports.getPrivateKey = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const openpgp_1 = require("openpgp");
const const_1 = require("./const");
let privateKey;
async function getPrivateKey() {
    if (!privateKey) {
        privateKey = await openpgp_1.readPrivateKey({
            armoredKey: await promises_1.default.readFile(const_1.privateKeyPath, { encoding: "utf-8" }),
        });
    }
    return privateKey;
}
exports.getPrivateKey = getPrivateKey;
let publicKey;
async function getPublicKey() {
    if (!publicKey) {
        publicKey = await openpgp_1.readKey({
            armoredKey: await promises_1.default.readFile(const_1.publicKeyPath, { encoding: "utf-8" }),
        });
    }
    return publicKey;
}
exports.getPublicKey = getPublicKey;
async function getPrivaryPublicUser() {
    const key = await getPublicKey();
    const primary = await key.getPrimaryUser();
    return primary.user;
}
exports.getPrivaryPublicUser = getPrivaryPublicUser;
//# sourceMappingURL=keys.js.map