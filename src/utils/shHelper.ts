'use strict';

import {SwiftConfig} from "../config/config";

/**
 * async function to execute shell command
 * @param {string} command
 * @return {promise}
 */
export async function runAsync(command: string) {
  const util = require('util');
  const exec = util.promisify(require('child_process').exec);
  return await exec(command);
}

export async function findAsync(dir: string, name: string, extension: string) {
  const cmd = 'find ' + dir + ' -iname "' + name + '.' + extension + '"';
  const {stdout, stderr} = await runAsync(cmd);
  let found = stdout.split('\n');
  found = found.filter( (x: string) => {
    return x.trim() !== '';
  });
  if (stderr) {
    return Promise.reject(stderr);
  }
  return found;
}

export async function swiftDownload(swiftConfig: SwiftConfig, targetDir: string) {
  const swiftCmd = `swift --os-auth-url ${swiftConfig.authUrl} --os-project-name ${swiftConfig.projectName} --os-username ${swiftConfig.userName} --os-password '${swiftConfig.password}' `;
  const cmd = `rm -rf ${targetDir} && mkdir -p ${targetDir} && ${swiftCmd} download ${swiftConfig.container} ${swiftConfig.objPath} -o ${targetDir}/result.json`;
  const {stderr} = await runAsync(cmd);
  if (stderr) {
    return Promise.reject(stderr);
  }
  // if download success, delete remote report (failsafe)
  runAsync(`${swiftCmd} delete ${swiftConfig.container} ${swiftConfig.objPath}`);
  return;
}
