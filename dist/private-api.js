"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFileBackups = exports.fetchFileBackups = exports.updateEncryptedFile = exports.updateFile = exports.fetchEncryptedFile = exports.fetchJsonFile = exports.fetchFile = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const openpgp_1 = require("openpgp");
const const_1 = require("./const");
const keys_1 = require("./keys");
async function fetchFile(path) {
    const url = new URL(path, const_1.apiUrl);
    return await node_fetch_1.default(url.toString()).then((res) => res.text());
}
exports.fetchFile = fetchFile;
async function fetchJsonFile(path) {
    const url = new URL(path, const_1.apiUrl);
    return (await node_fetch_1.default(url.toString()).then((res) => res.json()));
}
exports.fetchJsonFile = fetchJsonFile;
async function fetchEncryptedFile(path) {
    const url = new URL(path, const_1.apiUrl);
    const encryptedRes = await node_fetch_1.default(url.toString()).then((res) => res.text());
    const privateKey = await keys_1.getPrivateKey();
    const decrypted = await openpgp_1.decrypt({
        message: await openpgp_1.createMessage({ text: encryptedRes }),
        decryptionKeys: privateKey,
    });
    return decrypted.data;
}
exports.fetchEncryptedFile = fetchEncryptedFile;
function convertBodyToString(body) {
    if (typeof body === "object") {
        return JSON.stringify(body);
    }
    else
        return body;
}
async function updateFile(path, contents) {
    const url = new URL(path, const_1.apiUrl);
    const body = convertBodyToString(contents);
    const signed = await openpgp_1.sign({
        message: await openpgp_1.createMessage({ text: body }),
        signingKeys: await keys_1.getPrivateKey(),
        armor: true,
    });
    return await node_fetch_1.default(url.toString(), { body: signed, method: "post" }).then((res) => res.text());
}
exports.updateFile = updateFile;
async function updateEncryptedFile(path, contents) {
    const body = convertBodyToString(contents);
    const encrypted = openpgp_1.encrypt({
        message: await openpgp_1.createMessage({ text: body }),
        encryptionKeys: await keys_1.getPublicKey(),
        signingKeys: await keys_1.getPrivateKey(),
        armor: true,
    });
    return await updateFile(path, encrypted);
}
exports.updateEncryptedFile = updateEncryptedFile;
async function fetchFileBackups() {
    const user = await keys_1.getPrivaryPublicUser();
    try {
        return await fetchJsonFile(`/private/${user.userID?.email}/files`);
    }
    catch (e) {
        console.log('failed to fetch file backups');
        return [];
    }
}
exports.fetchFileBackups = fetchFileBackups;
async function updateFileBackups(files) {
    const user = await keys_1.getPrivaryPublicUser();
    await updateFile(`/private/${user.userID?.email}/files`, files);
}
exports.updateFileBackups = updateFileBackups;
//# sourceMappingURL=private-api.js.map