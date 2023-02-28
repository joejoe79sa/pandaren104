'use strict';
import * as kubernetes from '@kubernetes/client-node';
import { Writable } from 'stream';
import {GeneralConfig, K8sConfig, NfsConfig, SwiftConfig} from './../config/config';

export async function createNamespaceOfQuota(name: string, podCount: number, config: K8sConfig) {
  const k8sApi = initK8sAPI(config);

  const ns = loadTemplateFromFile(config.templatePath + '/namespace.yaml');
  ns.metadata.name = name;
  await k8sApi.createNamespace(ns);
  console.log('[INFO][K8S] namespace (' + name + ') created.');

  const quota = loadTemplateFromFile(config.templatePath + '/quota.yaml');
  quota.metadata.name = name;
  quota.spec.hard.pods = podCount;
  await k8sApi.createNamespacedResourceQuota(name, quota);
  console.log('[INFO][K8S] quota (' + podCount + ' pods) created.');

  return;
}

export async function createPVAndNamespacedPVC(name: string, namespace: string, config: K8sConfig, nfsConfig: NfsConfig) {
  const k8sApi = initK8sAPI(config);

  const pv = loadTemplateFromFile(config.templatePath + '/pv.yaml');
  pv.metadata.name = name;
  pv.spec.nfs.server = nfsConfig.server;
  pv.spec.nfs.path =  nfsConfig.folder + '/' + name;
  await k8sApi.createPersistentVolume(pv);
  console.log('[INFO][K8S] pv (' + name + ') created.');

  const pvc = loadTemplateFromFile(config.templatePath + '/pvc.yaml');
  pvc.metadata.name = name;
  await k8sApi.createNamespacedPersistentVolumeClaim(namespace, pvc);

  return;
}

export async function createNamespacedPod(
  name: string,
  image: string,
  pvc: string,
  namespace: string,
  config: K8sConfig,
  commands?: string[],
  timeout?: number,
  interval?: number,
  ) {
  timeout = (!timeout) ? 60 : timeout;
  interval = (!interval || interval <= 0) ? 5 : interval;

  const k8sApi = initK8sAPI(config);
  const pod = loadTemplateFromFile(config.templatePath + '/pod.yaml');
  pod.metadata.name = name;
  pod.metadata.labels.run = name;
  pod.spec.containers[0].name = name;
  pod.spec.containers[0].image = image;
  pod.spec.constructor[0].volumeMounts = [];
  pod.spec.constructor[0].volumeMounts.push({
    mountPath: '/src/target',
    name: 'nfs',
  });
  if (commands) {
    pod.spec.containers[0].command = pod.spec.containers[0].command.concat(commands);
  }
  pod.spec.volumes = [];
  pod.spec.volumes.push({
    name: 'nfs',
    persistentVolumeClaim: {
      claimName: pvc,
    },
  });

  let errMsg = '';
  while (timeout > 0) {
    try {
      await k8sApi.createNamespacedPod(namespace, pod);
      console.log('[INFO][K8S] pod (' + name + ') created.');
      errMsg = '';
    } catch (err) {
      errMsg = err.response ? err.response.body.message : err;
      await new Promise((resolve) => setTimeout(resolve, interval! * 1000));
      timeout = timeout - interval!;
    }
    if (errMsg === '') break;
  }
  if (errMsg !== '') {
    throw new Error(errMsg);
  }
  return;
}

export async function createNamespacedPodWithSwift(
    name: string,
    generalConfig: GeneralConfig,
    config: K8sConfig,
    swiftConfig: SwiftConfig,
    commands?: string[],
    timeout?: number,
    interval?: number,
) {
  timeout = (!timeout) ? 60 : timeout;
  interval = (!interval || interval <= 0) ? 5 : interval;

  const k8sApi = initK8sAPI(config);
  const pod = loadTemplateFromFile(config.templatePath + '/pod.yaml');
  const namespace = generalConfig.label;
  pod.metadata.name = name;
  pod.metadata.labels.run = name;
  pod.spec.containers[0].env.push({name: 'web_proxy', value: generalConfig.proxy});
  pod.spec.containers[0].env.push({name: 'pandaren_label', value: namespace});
  pod.spec.containers[0].env.push({name: SwiftConfig.key.SWIFT_URL, value: swiftConfig.authUrl});
  pod.spec.containers[0].env.push({name: SwiftConfig.key.SWIFT_CONTAINER, value: swiftConfig.container});
  pod.spec.containers[0].env.push({name: SwiftConfig.key.SWIFT_PROJECT, value: swiftConfig.projectName});
  pod.spec.containers[0].env.push({name: SwiftConfig.key.SWIFT_USER, value: swiftConfig.userName});
  pod.spec.containers[0].env.push({name: SwiftConfig.key.SWIFT_PASSWORD, value: swiftConfig.password});
  pod.spec.containers[0].name = name;
  pod.spec.containers[0].image = generalConfig.dockerImage;
  if (commands) {
    pod.spec.containers[0].command = pod.spec.containers[0].command.concat(commands);
  }

  let errMsg = '';
  while (timeout > 0) {
    try {
      await k8sApi.createNamespacedPod(namespace, pod);
      console.log('[INFO][K8S] pod (' + name + ') created.');
      errMsg = '';
    } catch (err) {
      errMsg = err.response ? err.response.body.message : err;
      await new Promise((resolve) => setTimeout(resolve, interval! * 1000));
      timeout = timeout - interval!;
    }
    if (errMsg === '') break;
  }
  if (errMsg !== '') {
    throw new Error(errMsg);
  }
  return;
}

export async function deletePV(pv: string , config: K8sConfig) {
  const k8sApi = initK8sAPI(config);

  await k8sApi.deletePersistentVolume(pv);
  console.log('[INFO][K8S] pv (' + pv + ') deleted.');
  return;
}

export async function deleteNamespace(namespace: string, config: K8sConfig) {
  const kc = new kubernetes.KubeConfig();
  kc.loadFromFile(config.kubeConfigFile);
  const k8sApi = kc.makeApiClient(kubernetes.CoreV1Api);

  await k8sApi.deleteNamespace(namespace);
  console.log('[INFO][K8S] namespace (' + namespace + ') deleted.');
  return;
}

export async function listNamespacedPods(namespace: string, config: K8sConfig, fieldSelector?: string) {
  const k8sApi = initK8sAPI(config);
  const response = await k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, fieldSelector);
  const pods = response.body.items;
  return pods;
}

export async function deleteNamespacedPod(name: string, namespace: string, config: K8sConfig) {
  const k8sApi = initK8sAPI(config);
  await k8sApi.deleteNamespacedPod(name, namespace, undefined, undefined, undefined, 0);
  console.log(`[INFO][K8S] pod (${name}) is deleted.`);
  return;
}

export async function waitNamespacedPodStatus(name: string, namespace: string, expectedStatus: string, timeout: number, config: K8sConfig, pauseStatus?: string) {
  const k8sApi = initK8sAPI(config);
  timeout = (!timeout) ? 60 : timeout;
  const interval = 5;

  while (timeout > 0) {
    const r = await k8sApi.readNamespacedPod(name, namespace)
        .catch((err) => {
          return null;
        });
    const status = r!.body!.status!.phase || 'na';
    if (status === expectedStatus) {
      console.log(`Pod (${name}) finished.`);
      return;
    }
    if (status === pauseStatus) {
      console.log("[POD ERROR BEGIN]: ---------------------------------");
      await log(name, name, namespace, config);
      console.log("[POD ERROR END]:   ---------------------------------");
      throw new Error(`Pod (${name}) failed.`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval! * 1000));
    timeout = timeout - interval!;
  }

  throw new Error('[RUN] (' + name + ') Timeout.');
}

async function log(podName: string, containerName: string, namespace: string, config: K8sConfig) {
  const kc = new kubernetes.KubeConfig();
  kc.loadFromFile(config.kubeConfigFile);
  await new Promise((resolve, reject) => {
    const podLogger = new kubernetes.Log(kc).log(
      namespace,
      podName,
      containerName,
      process.stdout as Writable,
      (err: any) => {
        resolve();
      },
    );
  });
  return;
}

function loadTemplateFromFile(file: string) {
  const yaml = require('yaml');
  const fs = require('fs');
  return yaml.parse(fs.readFileSync(file, 'utf8'));
}

function initK8sAPI(config: K8sConfig) {
  const kc = new kubernetes.KubeConfig();
  kc.loadFromFile(config.kubeConfigFile);
  return kc.makeApiClient(kubernetes.CoreV1Api);
}

