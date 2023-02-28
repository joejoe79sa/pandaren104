'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
function runAsync(command) {
    return __awaiter(this, void 0, void 0, function* () {
        const util = require('util');
        const exec = util.promisify(require('child_process').exec);
        return yield exec(command);
    });
}
exports.runAsync = runAsync;
function findAsync(dir, name, extension) {
    return __awaiter(this, void 0, void 0, function* () {
        const cmd = 'find ' + dir + ' -iname "' + name + '.' + extension + '"';
        const { stdout, stderr } = yield runAsync(cmd);
        let found = stdout.split('\n');
        found = found.filter((x) => {
            return x.trim() !== '';
        });
        if (stderr) {
            return Promise.reject(stderr);
        }
        return found;
    });
}
exports.findAsync = findAsync;
function swiftDownload(swiftConfig, targetDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const swiftCmd = `swift --os-auth-url ${swiftConfig.authUrl} --os-project-name ${swiftConfig.projectName} --os-username ${swiftConfig.userName} --os-password '${swiftConfig.password}' `;
        const cmd = `rm -rf ${targetDir} && mkdir -p ${targetDir} && ${swiftCmd} download ${swiftConfig.container} ${swiftConfig.objPath} -o ${targetDir}/result.json`;
        const { stderr } = yield runAsync(cmd);
        if (stderr) {
            return Promise.reject(stderr);
        }
        runAsync(`${swiftCmd} delete ${swiftConfig.container} ${swiftConfig.objPath}`);
        return;
    });
}
exports.swiftDownload = swiftDownload;
