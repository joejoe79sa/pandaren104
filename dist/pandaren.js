#!/usr/bin/env node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const commander_1 = __importDefault(require("commander"));
const fs = __importStar(require("fs-extra"));
const p_queue_1 = __importDefault(require("p-queue"));
const config_1 = require("./config/config");
const cucumber = __importStar(require("./gherkin/Cucumber"));
const k8s = __importStar(require("./utils/k8sHelper"));
const nfs = __importStar(require("./utils/nfsHelper"));
const shHelper_1 = require("./utils/shHelper");
const gherkin = cucumber;
function collect(value, previous) {
    return previous.concat([value]);
}
commander_1.default.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('   $ pandaren --help');
    console.log('   $ pandaren --dryrun');
});
commander_1.default
    .option('-F --folder <string>', 'path to story files', 'features')
    .option('-f --file <string>', 'name of story file. support wildcase *', '*')
    .option('-k --kubeconfig <string>', 'path to kubeconfig file')
    .option('-l --label <string>', 'a text indentifer for this test run')
    .option('-i --image <string>', 'docker image name', 'dockerregistry-rsnpk.vip.slc07.dev.ebayc3.com:5000/bolt-bdd-cucumberjs:70fdc6112cb94f2e6fa1b2bebdffb6458426123d')
    .option('-t --threadCount <number>', 'threadcount', 10)
    .option('-T --timeout <number>', 'timeout', 300)
    .option('-s --storage <string>', 'storage type nfs/swift', 'nfs')
    .option('-p --swiftPassword <string>', 'password of swift')
    .option('-P --proxy <string>', 'run time web proxy', '')
    .option('-r --retry <number>', 'retry chances', 0)
    .option('-d --dryrun', 'dryrun mode', false)
    .option('-o --option [key=value]', '(optional) extra run-time options passed to execute command.', collect, [])
    .parse(process.argv);
const commanderOpts = {
    general: {
        dockerImage: commander_1.default.image,
        label: commander_1.default.label,
        proxy: commander_1.default.proxy,
        retry: Number(commander_1.default.retry),
        storage: commander_1.default.storage,
        storyFolder: commander_1.default.folder,
        storyName: commander_1.default.file,
        threadCount: Number(commander_1.default.threadCount),
        timeout: Number(commander_1.default.timeout),
    },
    k8s: {
        kubeConfigFile: commander_1.default.kubeconfig,
    },
    options: {
        options: commander_1.default.option,
    },
    storage: {
        swift: {
            password: commander_1.default.swiftPassword,
        },
    },
};
const dryrun = commander_1.default.dryrun;
const config = new config_1.Config();
try {
    const localConfig = JSON.parse(fs.readFileSync(process.cwd() + '/pandaren.conf.json').toString());
    config.add(localConfig);
}
catch (err) {
    console.log('[INFO][FAILSAFE]' + err);
}
config.add(commanderOpts);
config.print();
const testExecutorQueue = new p_queue_1.default({ concurrency: config.general.threadCount });
const resultCollection = new gherkin.Result([], config.general);
const resultCollectorQueue = new p_queue_1.default({ concurrency: 1 });
(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log(chalk_1.default.yellowBright('Hello Pandaren 3.0 - v4'));
    const storyList = yield gherkin.searchStory(config.general.storyFolder, config.general.storyName);
    const storyCount = storyList.length;
    const planCount = config.options.matrixOpts.length;
    console.log(chalk_1.default.cyan('Total tests: ' + storyCount + '(stories) x ' + planCount + '(plans) = ' + storyCount * planCount));
    storyList.forEach((story) => {
        console.log('\t- ' + story);
    });
    if (!dryrun) {
        yield beforetest();
    }
    let testId = 0;
    for (const plan of config.options.matrixOpts) {
        for (const story of storyList) {
            const nameRegex = new RegExp('([^/]*)\\.');
            const nameMatches = nameRegex.exec(story);
            let testname = 's-' + testId;
            testId = testId + 1;
            let testUri = story;
            if (nameMatches) {
                testUri = nameMatches[1];
                testname = testname + '-' + nameMatches[1] + '-' + plan.meta_label;
                testname = testname.toLowerCase().replace(/[^-a-z0-9]/g, '-').substr(0, 55);
            }
            testname = testname + '-e';
            const gherkinDoc = gherkin.parseStory(story);
            const needExecute = gherkin.filterStory(gherkinDoc, plan.tags);
            if (!needExecute) {
                const message = `[TEST] (${testname}) is excluded by tags filter ${plan.tags}.`;
                console.log('[INFO]', message);
                const { results, status } = yield gherkin.collectResult(gherkinDoc, testUri, plan.meta_label, undefined, undefined, undefined, message);
                resultCollection.add(results[0]);
                continue;
            }
            if (dryrun) {
                console.log('[DRYRUN][INFO][TEST](' + testname + '] finished');
                continue;
            }
            let commands = ['--file=' + story, '--meta_id=' + testId];
            Object.keys(plan).forEach((key) => {
                commands = commands.concat('--' + key + '=' + plan[key]);
            });
            testExecutorQueue.add(() => __awaiter(void 0, void 0, void 0, function* () {
                return yield testExecute(testname, testUri, gherkinDoc, plan.meta_label, commands, 0);
            }));
        }
    }
    yield testExecutorQueue.onIdle();
    yield resultCollectorQueue.onIdle();
    if (!dryrun) {
        yield gherkin.generateReport(resultCollection, 'archive/report');
        if (resultCollection.fail > 0) {
            console.log(chalk_1.default.redBright('test is unstable'));
        }
        yield aftertest();
    }
    console.log(chalk_1.default.yellowBright('Bye pandaren 3.0'));
}))();
process.on('SIGINT', () => {
    console.log('Caught interrupt signal');
    if (!dryrun) {
        aftertest();
    }
});
process.on('unhandledRejection', (err, p) => {
    console.log('An unhandledRejection occurred');
    console.trace(err);
    console.log('[INFO][Clean up] before exit');
    if (!dryrun) {
        aftertest();
    }
    process.exit(2);
});
function beforetest() {
    return __awaiter(this, void 0, void 0, function* () {
        yield k8s.createNamespaceOfQuota(config.general.label, config.general.threadCount + 5, config.k8s);
        if (config.general.storage === 'nfs') {
            yield k8s.createPVAndNamespacedPVC(config.general.label, config.general.label, config.k8s, config.storage.nfs);
            yield nfs.mount('tmp', config.general.label, config.storage.nfs);
        }
        yield fs.ensureDir('archive');
        yield fs.emptyDir('archive');
        return;
    });
}
function aftertest() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield k8s.deleteNamespace(config.general.label, config.k8s);
            if (config.general.storage === 'nfs') {
                yield k8s.deletePV(config.general.label, config.k8s);
                yield nfs.umount('tmp');
            }
        }
        catch (err) {
            console.log('[INFO][FAILSAFE] failed to clean up');
        }
        return;
    });
}
function testExecute(name, uri, gherkinDoc, label, commands, tryIndex) {
    return __awaiter(this, void 0, void 0, function* () {
        const podName = name + '-' + tryIndex;
        let exception = '';
        try {
            if (config.general.storage === 'swift') {
                yield k8s.createNamespacedPodWithSwift(podName, config.general, config.k8s, config.storage.swift, commands);
            }
            else if (config.general.storage === 'nfs') {
                yield k8s.createNamespacedPod(podName, config.general.dockerImage, config.general.label, config.general.label, config.k8s, commands);
            }
            else {
                throw new Error(`storage ${config.general.storage} is not supported`);
            }
            yield k8s.waitNamespacedPodStatus(podName, config.general.label, 'Succeeded', config.general.timeout, config.k8s, 'Failed');
        }
        catch (err) {
            console.log(`[ERROR] failed to execute test: ${err}`);
            exception = err || '[ERROR] failed to execute test in k8s';
        }
        resultCollectorQueue.add(() => __awaiter(this, void 0, void 0, function* () {
            return yield resultCollect(name, uri, gherkinDoc, label, commands, tryIndex, exception);
        }));
        console.log('[INFO][TEST][RUN #' + tryIndex + '](' + name + ') finished.');
        return;
    });
}
function resultCollect(name, uri, gherkinDoc, label, commands, tryIndex, exception) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetDir = `tmp/${name}-${tryIndex}`;
        if (!exception && config.general.storage === 'swift') {
            const swiftConfig = config.storage.swift;
            swiftConfig.setObjectPath(`target/${config.general.label}/${name}-${tryIndex}/result.json`);
            let download_success = false;
            let download_error;
            for (let i = 0; i < 6; i++) {
                try {
                    yield shHelper_1.swiftDownload(swiftConfig, targetDir);
                    download_success = true;
                    break;
                }
                catch (e) {
                    console.log(`[download] [swift] [${i}] failed: ${swiftConfig.objPath}.`);
                    download_error = e.stderr;
                    console.log(e.stderr);
                    yield sleep(10);
                }
            }
            if (!download_success) {
                exception = download_error || 'failed to download report from swift.';
            }
        }
        const { results, status } = yield gherkin.collectResult(gherkinDoc, uri, label, commands, targetDir, exception);
        const statusValue = status.toString();
        if ((statusValue === 'FAILED') && (tryIndex < config.general.retry)) {
            testExecutorQueue.add(() => __awaiter(this, void 0, void 0, function* () {
                const nextTryIndex = tryIndex + 1;
                console.log('[INFO][TEST](' + name + ') ' + status + ', will retry [#' + nextTryIndex + '].');
                return yield testExecute(name, uri, gherkinDoc, label, commands, nextTryIndex);
            }));
        }
        else {
            console.log('[INFO][TEST](' + name + ') ' + status + '.');
        }
        results.forEach((result) => {
            resultCollection.add(result);
        });
        return;
    });
}
function sleep(s) {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
