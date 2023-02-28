import { NfsConfig} from './../config/config';
import * as Shell from './../utils/shHelper';

async function mkdirRemote(path: string, config: NfsConfig) {
  const nodeSsh = require('node-ssh');
  const ssh = new nodeSsh();
  await ssh.connect({
    host: config.server,
    privateKey: config.sshIdentityFile,
    username: config.sshUser,
  });
  path = config.root + '/' + path;
  await ssh.execCommand('rm -rf ' + path);
  await ssh.execCommand('mkdir -p ' + path);
  await ssh.dispose();
  return;
}

export async function mount(local: string, remote: string, config: NfsConfig) {
  const fs = require('fs-extra');
  fs.ensureDirSync(local);
  fs.emptyDirSync(local);
  console.log('[INFO][NFS] create local folder ' + local);

  remote = config.folder + '/' + remote;
  await mkdirRemote(remote, config);
  console.log('[INFO][NFS] create remote folder ' + remote);

  await Shell.runAsync('sudo mount -v -o vers=4,loud ' + config.server + ':' + remote + ' ' + local);
  console.log('[INFO][NFS] mount remote (' + remote + ') to local (' + local + ').');
  return;
}

export async function umount(local: string) {
  await Shell.runAsync('sudo umount -f ' + local);
  console.log('[INFO][NFS] force umount local (' + local + ').');
  return;
}
