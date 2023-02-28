#!/usr/bin/env node
import Chalk from 'chalk';
import Commander from 'commander';
import * as fs from 'fs-extra';
import PQueue from 'p-queue';
import {Config, SwiftConfig} from './config/config';
import * as cucumber from './gherkin/Cucumber';
import * as k8s from './utils/k8sHelper';
import * as nfs from './utils/nfsHelper';
import {swiftDownload} from "./utils/shHelper";
const gherkin = cucumber;

function collect(value: string, previous: [string]) {
  return previous.concat([value]);
}
// print additional help message
Commander.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('   $ pandaren --help');
  console.log('   $ pandaren --dryrun');
});

Commander
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
    dockerImage: Commander.image,
    label: Commander.label,
    proxy: Commander.proxy,
    retry: Number(Commander.retry),
    storage: Commander.storage,
    storyFolder: Commander.folder,
    storyName: Commander.file,
    threadCount: Number(Commander.threadCount),
    timeout: Number(Commander.timeout),
  },
  k8s: {
    kubeConfigFile : Commander.kubeconfig,
  },
  options: {
    options: Commander.option,
  },
  storage: {
    swift: {
      password: Commander.swiftPassword,
    },
  },
};

const dryrun = Commander.dryrun;

const config = new Config();
try {
  const localConfig = JSON.parse(fs.readFileSync(process.cwd() + '/pandaren.conf.json').toString());
  config.add(localConfig);
} catch (err) {
  console.log('[INFO][FAILSAFE]' + err);
}
config.add(commanderOpts);
config.print();

const testExecutorQueue = new PQueue({concurrency: config.general.threadCount });
const resultCollection = new gherkin.Result([], config.general);
const resultCollectorQueue = new PQueue({concurrency: 1 });

(async () => {
  console.log(Chalk.yellowBright('Hello Pandaren 3.0 - v4'));
  const storyList: string[] = await gherkin.searchStory(config.general.storyFolder, config.general.storyName);
  const storyCount: number = storyList.length;
  const planCount: number = config.options.matrixOpts.length;
  console.log(Chalk.cyan('Total tests: ' + storyCount + '(stories) x ' + planCount + '(plans) = ' +  storyCount * planCount));
  storyList.forEach((story) => {
    console.log('\t- ' + story);
  });

  // prepare
  if (! dryrun) {
    await beforetest();
  }

  // // start to execute
  let testId: number = 0;
  for (const plan of config.options.matrixOpts) {
    for (const story of storyList) {
      const nameRegex = new RegExp('([^/]*)\\.');
      const nameMatches = nameRegex.exec(story);
      let testname = 's-' + testId ;
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
      if (! needExecute) {
        const message = `[TEST] (${testname}) is excluded by tags filter ${plan.tags}.`;
        console.log('[INFO]', message);
        const {results, status} = await gherkin.collectResult(gherkinDoc, testUri, plan.meta_label, undefined, undefined, undefined, message);
        resultCollection.add(results[0]);
        continue;
      }
      if (dryrun) {
        console.log('[DRYRUN][INFO][TEST](' + testname + '] finished');
        continue;
      }
      let commands: string[] = ['--file=' + story, '--meta_id=' + testId];
      Object.keys(plan).forEach((key: string) => {
        commands = commands.concat('--' + key + '=' + plan[key]);
      });
      testExecutorQueue.add(async () => {
        return await testExecute(testname, testUri, gherkinDoc, plan.meta_label, commands, 0);
      });
    }
  }
  await testExecutorQueue.onIdle();
  await resultCollectorQueue.onIdle();
  if (! dryrun) {
    // generate report
    await gherkin.generateReport(resultCollection, 'archive/report');
    if (resultCollection.fail > 0) {
      console.log(Chalk.redBright('test is unstable'));
    }
    // clean up
    await aftertest();
  }
  console.log(Chalk.yellowBright('Bye pandaren 3.0'));
})();

process.on('SIGINT', () => {
  console.log('Caught interrupt signal');
  if (! dryrun) {
    aftertest();
  }
});

process.on('unhandledRejection', (err, p) => {
  console.log('An unhandledRejection occurred');
  console.trace(err);
  console.log('[INFO][Clean up] before exit');
  if (! dryrun) {
    aftertest();
  }
  process.exit(2);
});

async function beforetest() {
  await k8s.createNamespaceOfQuota(config.general.label, config.general.threadCount + 5, config.k8s);
  if (config.general.storage === 'nfs') {
    await k8s.createPVAndNamespacedPVC(config.general.label, config.general.label, config.k8s, config.storage.nfs);
    await nfs.mount('tmp', config.general.label, config.storage.nfs);
  }
  await fs.ensureDir('archive');
  await fs.emptyDir('archive');
  return;
}

async function aftertest() {
  try {
    await k8s.deleteNamespace(config.general.label, config.k8s);
    if (config.general.storage === 'nfs') {
      await k8s.deletePV(config.general.label, config.k8s);
      await nfs.umount('tmp');
    }
  } catch (err) {
    console.log('[INFO][FAILSAFE] failed to clean up');
  }
  return;
}

async function testExecute(name: string, uri: string, gherkinDoc: any, label: string, commands: string[], tryIndex: number) {
  const podName = name + '-' + tryIndex;
  let exception: string = '';
  try {
    if (config.general.storage === 'swift') {
      await k8s.createNamespacedPodWithSwift(
          podName,
          config.general,
          config.k8s,
          config.storage.swift,
          commands);
    } else if (config.general.storage === 'nfs') {
      await k8s.createNamespacedPod(
          podName,
          config.general.dockerImage,
          config.general.label,
          config.general.label,
          config.k8s,
          commands,
      );
    } else {
      throw new Error(`storage ${config.general.storage} is not supported`);
    }
    await k8s.waitNamespacedPodStatus(podName, config.general.label, 'Succeeded', config.general.timeout, config.k8s, 'Failed');
  } catch (err) {
    console.log(`[ERROR] failed to execute test: ${err}`);
    // timeout/network glitch/..
    exception = err || '[ERROR] failed to execute test in k8s';
  }

  resultCollectorQueue.add(async () => {
    return await resultCollect(name, uri, gherkinDoc, label, commands, tryIndex, exception);
  });
  console.log('[INFO][TEST][RUN #' + tryIndex + '](' + name + ') finished.');
  return;
}

async function resultCollect(
  name: string,
  uri: string,
  gherkinDoc: any,
  label: string,
  commands: string[],
  tryIndex: number,
  exception?: string) {
  const targetDir = `tmp/${name}-${tryIndex}`;
  // if no exception and storage type is swift, need download report from swift to local.
  if (!exception && config.general.storage === 'swift') {
    const swiftConfig = config.storage.swift;
    swiftConfig.setObjectPath(`target/${config.general.label}/${name}-${tryIndex}/result.json`);
    let download_success = false;
    let download_error;
    for (let i = 0; i < 6; i++) {
      try {
        await swiftDownload(swiftConfig, targetDir);
        download_success = true;
        break;
      } catch (e) {
        console.log(`[download] [swift] [${i}] failed: ${swiftConfig.objPath}.`);
        download_error = e.stderr;
        console.log(e.stderr);
        await sleep(10);
      }
    }
    if (!download_success) {
      exception = download_error || 'failed to download report from swift.';
    }
  }

  const {results, status} = await gherkin.collectResult(gherkinDoc, uri, label, commands, targetDir, exception);
  const statusValue = status.toString();

  // retry
  if ((statusValue === 'FAILED') && (tryIndex < config.general.retry)) {
    testExecutorQueue.add(async () => {
      const nextTryIndex = tryIndex + 1;
      console.log('[INFO][TEST](' + name + ') ' + status + ', will retry [#' + nextTryIndex + '].');
      return await testExecute(name, uri, gherkinDoc, label, commands, nextTryIndex);
    });
  } else {
    console.log('[INFO][TEST](' + name + ') ' + status + '.');
  }

  results.forEach((result) => {
    resultCollection.add(result);
  });
  return;
}

function sleep(s: number) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
