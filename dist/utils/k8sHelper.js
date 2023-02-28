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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const kubernetes = __importStar(require("@kubernetes/client-node"));
const config_1 = require("./../config/config");
function createNamespaceOfQuota(name, podCount, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        const ns = loadTemplateFromFile(config.templatePath + '/namespace.yaml');
        ns.metadata.name = name;
        yield k8sApi.createNamespace(ns);
        console.log('[INFO][K8S] namespace (' + name + ') created.');
        const quota = loadTemplateFromFile(config.templatePath + '/quota.yaml');
        quota.metadata.name = name;
        quota.spec.hard.pods = podCount;
        yield k8sApi.createNamespacedResourceQuota(name, quota);
        console.log('[INFO][K8S] quota (' + podCount + ' pods) created.');
        return;
    });
}
exports.createNamespaceOfQuota = createNamespaceOfQuota;
function createPVAndNamespacedPVC(name, namespace, config, nfsConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        const pv = loadTemplateFromFile(config.templatePath + '/pv.yaml');
        pv.metadata.name = name;
        pv.spec.nfs.server = nfsConfig.server;
        pv.spec.nfs.path = nfsConfig.folder + '/' + name;
        yield k8sApi.createPersistentVolume(pv);
        console.log('[INFO][K8S] pv (' + name + ') created.');
        const pvc = loadTemplateFromFile(config.templatePath + '/pvc.yaml');
        pvc.metadata.name = name;
        yield k8sApi.createNamespacedPersistentVolumeClaim(namespace, pvc);
        return;
    });
}
exports.createPVAndNamespacedPVC = createPVAndNamespacedPVC;
function createNamespacedPod(name, image, pvc, namespace, config, commands, timeout, interval) {
    return __awaiter(this, void 0, void 0, function* () {
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
                yield k8sApi.createNamespacedPod(namespace, pod);
                console.log('[INFO][K8S] pod (' + name + ') created.');
                errMsg = '';
            }
            catch (err) {
                errMsg = err.response ? err.response.body.message : err;
                yield new Promise((resolve) => setTimeout(resolve, interval * 1000));
                timeout = timeout - interval;
            }
            if (errMsg === '')
                break;
        }
        if (errMsg !== '') {
            throw new Error(errMsg);
        }
        return;
    });
}
exports.createNamespacedPod = createNamespacedPod;
function createNamespacedPodWithSwift(name, generalConfig, config, swiftConfig, commands, timeout, interval) {
    return __awaiter(this, void 0, void 0, function* () {
        timeout = (!timeout) ? 60 : timeout;
        interval = (!interval || interval <= 0) ? 5 : interval;
        const k8sApi = initK8sAPI(config);
        const pod = loadTemplateFromFile(config.templatePath + '/pod.yaml');
        const namespace = generalConfig.label;
        pod.metadata.name = name;
        pod.metadata.labels.run = name;
        pod.spec.containers[0].env.push({ name: 'web_proxy', value: generalConfig.proxy });
        pod.spec.containers[0].env.push({ name: 'pandaren_label', value: namespace });
        pod.spec.containers[0].env.push({ name: config_1.SwiftConfig.key.SWIFT_URL, value: swiftConfig.authUrl });
        pod.spec.containers[0].env.push({ name: config_1.SwiftConfig.key.SWIFT_CONTAINER, value: swiftConfig.container });
        pod.spec.containers[0].env.push({ name: config_1.SwiftConfig.key.SWIFT_PROJECT, value: swiftConfig.projectName });
        pod.spec.containers[0].env.push({ name: config_1.SwiftConfig.key.SWIFT_USER, value: swiftConfig.userName });
        pod.spec.containers[0].env.push({ name: config_1.SwiftConfig.key.SWIFT_PASSWORD, value: swiftConfig.password });
        pod.spec.containers[0].name = name;
        pod.spec.containers[0].image = generalConfig.dockerImage;
        if (commands) {
            pod.spec.containers[0].command = pod.spec.containers[0].command.concat(commands);
        }
        let errMsg = '';
        while (timeout > 0) {
            try {
                yield k8sApi.createNamespacedPod(namespace, pod);
                console.log('[INFO][K8S] pod (' + name + ') created.');
                errMsg = '';
            }
            catch (err) {
                errMsg = err.response ? err.response.body.message : err;
                yield new Promise((resolve) => setTimeout(resolve, interval * 1000));
                timeout = timeout - interval;
            }
            if (errMsg === '')
                break;
        }
        if (errMsg !== '') {
            throw new Error(errMsg);
        }
        return;
    });
}
exports.createNamespacedPodWithSwift = createNamespacedPodWithSwift;
function deletePV(pv, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        yield k8sApi.deletePersistentVolume(pv);
        console.log('[INFO][K8S] pv (' + pv + ') deleted.');
        return;
    });
}
exports.deletePV = deletePV;
function deleteNamespace(namespace, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const kc = new kubernetes.KubeConfig();
        kc.loadFromFile(config.kubeConfigFile);
        const k8sApi = kc.makeApiClient(kubernetes.CoreV1Api);
        yield k8sApi.deleteNamespace(namespace);
        console.log('[INFO][K8S] namespace (' + namespace + ') deleted.');
        return;
    });
}
exports.deleteNamespace = deleteNamespace;
function listNamespacedPods(namespace, config, fieldSelector) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        const response = yield k8sApi.listNamespacedPod(namespace, undefined, undefined, undefined, fieldSelector);
        const pods = response.body.items;
        return pods;
    });
}
exports.listNamespacedPods = listNamespacedPods;
function deleteNamespacedPod(name, namespace, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        yield k8sApi.deleteNamespacedPod(name, namespace, undefined, undefined, undefined, 0);
        console.log(`[INFO][K8S] pod (${name}) is deleted.`);
        return;
    });
}
exports.deleteNamespacedPod = deleteNamespacedPod;
function waitNamespacedPodStatus(name, namespace, expectedStatus, timeout, config, pauseStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        const k8sApi = initK8sAPI(config);
        timeout = (!timeout) ? 60 : timeout;
        const interval = 5;
        while (timeout > 0) {
            const r = yield k8sApi.readNamespacedPod(name, namespace)
                .catch((err) => {
                return null;
            });
            const status = r.body.status.phase || 'na';
            if (status === expectedStatus) {
                console.log(`Pod (${name}) finished.`);
                return;
            }
            if (status === pauseStatus) {
                console.log("[POD ERROR BEGIN]: ---------------------------------");
                yield log(name, name, namespace, config);
                console.log("[POD ERROR END]:   ---------------------------------");
                throw new Error(`Pod (${name}) failed.`);
            }
            yield new Promise((resolve) => setTimeout(resolve, interval * 1000));
            timeout = timeout - interval;
        }
        throw new Error('[RUN] (' + name + ') Timeout.');
    });
}
exports.waitNamespacedPodStatus = waitNamespacedPodStatus;
function log(podName, containerName, namespace, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const kc = new kubernetes.KubeConfig();
        kc.loadFromFile(config.kubeConfigFile);
        yield new Promise((resolve, reject) => {
            const podLogger = new kubernetes.Log(kc).log(namespace, podName, containerName, process.stdout, (err) => {
                resolve();
            });
        });
        return;
    });
}
function loadTemplateFromFile(file) {
    const yaml = require('yaml');
    const fs = require('fs');
    return yaml.parse(fs.readFileSync(file, 'utf8'));
}
function initK8sAPI(config) {
    const kc = new kubernetes.KubeConfig();
    kc.loadFromFile(config.kubeConfigFile);
    return kc.makeApiClient(kubernetes.CoreV1Api);
}
