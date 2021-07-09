"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ipfs_core_1 = require("ipfs-core");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const openpgp_1 = require("openpgp");
const crypto_1 = __importDefault(require("crypto"));
const private_api_1 = require("./private-api");
const const_1 = require("./const");
const ipfsPath = path_1.default.resolve(process.cwd(), "data/ipfs");
async function main() {
    if (!process.env.PRIVATE_KEY_PATH) {
        throw new Error("PRIVATE_KEY_PATH must be set");
    }
    if (!process.env.PUBLIC_KEY_PATH) {
        throw new Error("PUBLIC_KEY_PATH must be set");
    }
    const armoredPrivateKey = await fs_1.default.promises.readFile(process.env.PRIVATE_KEY_PATH, { encoding: "utf-8" });
    const armoredPublicKey = await fs_1.default.promises.readFile(process.env.PRIVATE_KEY_PATH, { encoding: "utf-8" });
    const publicKey = await openpgp_1.readKey({ armoredKey: armoredPublicKey });
    const privateKey = await openpgp_1.readPrivateKey({ armoredKey: armoredPrivateKey });
    const ipfs = await ipfs_core_1.create({
        repo: ipfsPath,
    });
    const context = { ipfs, publicKey, privateKey };
    setInterval(() => backupFiles(context), 10 * 1000);
}
function getFileHash(filePath, type = "sha1") {
    return new Promise((res, rej) => {
        const hash = crypto_1.default.createHash(type);
        hash.setEncoding("hex");
        fs_1.default.createReadStream(filePath).pipe(hash);
        hash.on("finish", () => {
            res(hash.read());
        });
    });
}
async function backupFiles({ ipfs, publicKey, privateKey }) {
    const fileBackups = await private_api_1.fetchFileBackups();
    let newFileBackups = Array.from(fileBackups);
    const folderPath = path_1.default.resolve(const_1.photoFolderPath);
    const files = await fs_1.default.promises.readdir(folderPath);
    for (const filename of files) {
        const filePath = path_1.default.resolve(folderPath, filename);
        const stat = await fs_1.default.promises.stat(filePath);
        if (!stat.isDirectory()) {
            const fileHash = await getFileHash(filePath);
            const backup = newFileBackups.find((b) => b.path === filename);
            if (backup && backup.fileHash !== fileHash) {
                console.log(`Removing old file ${filePath}, old: ${backup.fileHash} new: ${fileHash}`);
                newFileBackups = newFileBackups.filter((b) => b.fileHash !== backup.fileHash);
                await ipfs.pin.rm(new ipfs_core_1.CID(backup.ipfsHash));
            }
            if (!backup || backup.fileHash !== fileHash) {
                const message = await openpgp_1.createMessage({
                    filename,
                    binary: fs_1.default.createReadStream(filePath),
                });
                const encrypted = await openpgp_1.encrypt({
                    message,
                    encryptionKeys: publicKey,
                    signingKeys: privateKey,
                    armor: false,
                });
                const { cid } = await ipfs.add(encrypted);
                await ipfs.pin.add(cid);
                console.log(`added ${filename} to ipfs ${cid.toString()}`);
                newFileBackups.push({
                    path: filename,
                    ipfsHash: cid.toString(),
                    fileHash: fileHash,
                });
            }
        }
    }
    await private_api_1.updateFileBackups(newFileBackups);
    const pins = await ipfs.pin.ls();
    console.log('current pins');
    for await (const pin of pins) {
        console.log(pin.cid);
    }
}
main();
//# sourceMappingURL=index.js.map