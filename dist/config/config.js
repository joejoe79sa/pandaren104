"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const randomWords = require('random-words');
const _ = require('lodash');
const chalk = require('chalk');
class Config {
    constructor(nfs, k8s, general, options) {
        this.storage = new StorageConfig();
        this.k8s = new K8sConfig();
        this.general = new GeneralConfig();
        this.options = new Options();
        if (k8s) {
            this.k8s = k8s;
        }
        if (general) {
            this.general = general;
        }
        if (options) {
            this.options = options;
        }
    }
    add(custom) {
        const props = Object.keys(this);
        props.forEach((prop) => {
            if (custom[prop]) {
                if (prop === 'options') {
                    this.options.options = this.options.options.concat(custom.options.options);
                    this.options.parseOpts = this.options.parse();
                    this.options.matrixOpts = this.options.matrix();
                }
                else {
                    _.merge(this[prop], custom[prop]);
                }
            }
        });
    }
    print() {
        console.log(chalk.cyan('General Configuration:'));
        const generalProps = Object.keys(this.general);
        generalProps.forEach((prop) => {
            console.log('\t-  ' + prop + ': ' + this.general[prop]);
        });
        console.log('');
        console.log(chalk.cyan('nfs Configuration:'));
        const nfsProps = Object.keys(this.storage.nfs);
        nfsProps.forEach((prop) => {
            console.log('\t-  ' + prop + ': ' + this.storage.nfs[prop]);
        });
        console.log('');
        console.log(chalk.cyan('swift Configuration:'));
        const swiftProps = Object.keys(this.storage.swift);
        swiftProps.forEach((prop) => {
            console.log('\t-  ' + prop + ': ' + this.storage.swift[prop]);
        });
        console.log('');
        console.log(chalk.cyan('K8S Configuration:'));
        const k8sProps = Object.keys(this.k8s);
        k8sProps.forEach((prop) => {
            console.log('\t-  ' + prop + ': ' + this.k8s[prop]);
        });
        console.log(chalk.cyan('Test Plan:'));
        let i = 1;
        this.options.matrixOpts.forEach((plan) => {
            console.log('[plan ' + i + ']:');
            Object.keys(plan).forEach((key) => {
                console.log('\t-  ' + key + ': ' + plan[key]);
            });
            i = i + 1;
        });
        console.log('\n');
    }
}
exports.Config = Config;
class StorageConfig {
    constructor() {
        this.nfs = new NfsConfig();
        this.swift = new SwiftConfig();
    }
}
exports.StorageConfig = StorageConfig;
class NfsConfig {
    constructor(sshUser, sshIdentityFile, server, root, folder) {
        this.sshUser = 'stack';
        this.sshIdentityFile = process.env.HOME + '/.ssh/bolt_id_rsa';
        this.server = 'panda-3254280.slc07.dev.ebayc3.com';
        this.root = '/nfs';
        this.folder = '/default';
        if (sshUser) {
            this.sshUser = sshUser;
        }
        if (sshIdentityFile) {
            this.sshIdentityFile = sshIdentityFile;
        }
        if (server) {
            this.server = server;
        }
        if (root) {
            this.root = root;
        }
        if (folder) {
            this.folder = folder;
        }
    }
}
exports.NfsConfig = NfsConfig;
class SwiftConfig {
    constructor(authUrl, projectName, userName, pasword, container, objPath) {
        this.authUrl = 'https://keystone.ams1.cloud.ecg.so/v2.0';
        this.projectName = 'bt-ci';
        this.userName = 'bolt-cloud';
        this.password = '';
        this.container = 'automation';
        this.objPath = 'temp';
        if (authUrl) {
            this.authUrl = authUrl;
        }
        if (projectName) {
            this.projectName = projectName;
        }
        if (userName) {
            this.userName = userName;
        }
        if (pasword) {
            this.password = pasword;
        }
        if (container) {
            this.container = container;
        }
        if (objPath) {
            this.objPath = objPath;
        }
    }
    setObjectPath(path) {
        this.objPath = path;
    }
}
exports.SwiftConfig = SwiftConfig;
SwiftConfig.key = {
    SWIFT_CONTAINER: 'pandaren_swift_container',
    SWIFT_PASSWORD: 'pandaren_swift_password',
    SWIFT_PROJECT: 'pandaren_swift_project',
    SWIFT_URL: 'pandaren_swift_url',
    SWIFT_USER: 'pandaren_swift_user',
};
class K8sConfig {
    constructor(kubeConfigFile, templatePath) {
        this.kubeConfigFile = process.env.HOME + '/.kube/config';
        this.templatePath = __dirname + '/../../k8sTemplate';
        if (kubeConfigFile) {
            this.kubeConfigFile = kubeConfigFile;
        }
        if (templatePath) {
            this.templatePath = templatePath;
        }
    }
}
exports.K8sConfig = K8sConfig;
class GeneralConfig {
    constructor(label, storyFolder, storyName, dockerImage, threadCount, retry, storage, proxy) {
        this.label = 'panda-' + randomWords({ exactly: 2, join: '-', maxLength: 6 });
        this.storyFolder = process.cwd() + '/features';
        this.storyName = '*';
        this.dockerImage = 'dockerregistry-rsnpk.vip.slc07.dev.ebayc3.com:5000/bolt-bdd-cucumberjs:650741b0fb5348c6eadedc42ff293779189f14f9';
        this.threadCount = 10;
        this.timeout = 300;
        this.retry = 0;
        this.storage = 'nfs';
        this.proxy = '';
        if (label) {
            this.label = label;
        }
        if (storyFolder) {
            this.storyFolder = storyFolder;
        }
        if (storyName) {
            this.storyName = storyName;
        }
        if (dockerImage) {
            this.dockerImage = dockerImage;
        }
        if (threadCount) {
            this.threadCount = threadCount;
        }
        if (retry) {
            this.retry = retry;
        }
        if (storage) {
            this.storage = storage;
        }
        if (proxy) {
            this.proxy = proxy;
        }
    }
}
exports.GeneralConfig = GeneralConfig;
class Options {
    constructor(options, supportedOptions, allowUnknownOption, seperator, joiner) {
        this.allowUnknownOption = true;
        this.supportedOptions = [
            'meta_label',
            'tags',
        ];
        this.seperator = ',';
        this.joiner = '\\+';
        this.options = [
            'site=mx_vns,za',
            'tags="@{{site}} and @{{device}}"',
            'meta_label={{site}}_{{mobileName}}',
            'device+mobileName=desktop,mobile+iphone_6s',
        ];
        this.parseOpts = this.parse();
        this.matrixOpts = this.matrix();
        if (options) {
            this.options = options;
        }
        if (supportedOptions) {
            this.supportedOptions = supportedOptions;
        }
        if (allowUnknownOption) {
            this.allowUnknownOption = allowUnknownOption;
        }
        if (seperator) {
            this.seperator = seperator;
        }
        if (joiner) {
            this.joiner = joiner;
        }
        this.parseOpts = this.parse();
        this.matrixOpts = this.matrix();
    }
    parse() {
        const parseOpts = [];
        this.options.forEach((optText) => {
            const keyvalueRegex = new RegExp('(.{1,}?)=(.*)');
            const matches = keyvalueRegex.exec(optText);
            const opts = [];
            if (matches) {
                const opt = {
                    key: matches[1],
                    value: matches[2].split(this.seperator),
                };
                const exist = parseOpts.filter((x) => {
                    return x.key === opt.key;
                });
                if (exist[0]) {
                    exist[0].value = opt.value;
                }
                else {
                    parseOpts.push(opt);
                }
            }
            else {
                console.log('[WARN] unrecognized option: ' + optText);
            }
        });
        return parseOpts;
    }
    matrix() {
        let matrixOpts = [{}];
        optionLoop: this.parseOpts.forEach((parseOpt) => {
            const key = parseOpt.key;
            const values = parseOpt.value;
            const childOpts = [];
            values.forEach((value) => {
                const joinRegex = new RegExp('([^' + this.joiner + ']{1,})' + this.joiner + '?(.*)');
                let remainKey = key;
                let remainValue = value;
                let keyJoinMatches = joinRegex.exec(remainKey);
                let valueJoinMatches = joinRegex.exec(remainValue);
                const opt = {};
                subKeyLoop: while (keyJoinMatches) {
                    const subKey = keyJoinMatches[1];
                    remainKey = keyJoinMatches[2];
                    const subValue = valueJoinMatches ? valueJoinMatches[1] : '';
                    remainValue = valueJoinMatches ? valueJoinMatches[2] : '';
                    opt[subKey] = subValue;
                    keyJoinMatches = joinRegex.exec(remainKey);
                    valueJoinMatches = joinRegex.exec(remainValue);
                }
                childOpts.push(opt);
            });
            if (childOpts.length > 0) {
                const temp = [];
                matrixOpts.forEach((prev) => {
                    childOpts.forEach((opt) => {
                        const merged = _.merge({}, prev, opt);
                        temp.push(merged);
                    });
                });
                matrixOpts = temp;
            }
        });
        matrixOpts.forEach((opt) => {
            Object.keys(opt).forEach((key) => {
                let remainVal = opt[key];
                const varRegex = new RegExp('{{(.*?)}}(.*)');
                let varMatches = varRegex.exec(remainVal);
                while (varMatches) {
                    const varReplaceKey = varMatches[1];
                    remainVal = varMatches[2];
                    if (opt[varReplaceKey] !== undefined) {
                        opt[key] = opt[key].replace('{{' + varReplaceKey + '}}', opt[varReplaceKey]);
                    }
                    varMatches = varRegex.exec(remainVal);
                }
            });
        });
        return matrixOpts;
    }
}
