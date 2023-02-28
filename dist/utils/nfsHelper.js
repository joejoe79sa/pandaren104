"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Shell = __importStar(require("./../utils/shHelper"));
function mkdirRemote(path, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodeSsh = require('node-ssh');
        const ssh = new nodeSsh();
        yield ssh.connect({
            host: config.server,
            privateKey: config.sshIdentityFile,
            username: config.sshUser,
        });
        path = config.root + '/' + path;
        yield ssh.execCommand('rm -rf ' + path);
        yield ssh.execCommand('mkdir -p ' + path);
        yield ssh.dispose();
        return;
    });
}
function mount(local, remote, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const fs = require('fs-extra');
        fs.ensureDirSync(local);
        fs.emptyDirSync(local);
        console.log('[INFO][NFS] create local folder ' + local);
        remote = config.folder + '/' + remote;
        yield mkdirRemote(remote, config);
        console.log('[INFO][NFS] create remote folder ' + remote);
        yield Shell.runAsync('sudo mount -v -o vers=4,loud ' + config.server + ':' + remote + ' ' + local);
        console.log('[INFO][NFS] mount remote (' + remote + ') to local (' + local + ').');
        return;
    });
}
exports.mount = mount;
function umount(local) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Shell.runAsync('sudo umount -f ' + local);
        console.log('[INFO][NFS] force umount local (' + local + ').');
        return;
    });
}
exports.umount = umount;
