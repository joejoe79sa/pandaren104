// // default config
const randomWords = require('random-words');
const _ = require('lodash');
const chalk = require('chalk');

export class Config {
  public storage: StorageConfig = new StorageConfig();
  public k8s: K8sConfig = new K8sConfig();
  public general: GeneralConfig = new GeneralConfig();
  public options: Options = new Options();

  constructor(nfs?: NfsConfig, k8s?: K8sConfig, general?: GeneralConfig, options?: Options) {
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

  public add(custom: {[k: string]: any}) {
    const props: Array<keyof Config> = Object.keys(this) as Array<keyof Config>;
    props.forEach((prop) => {
      if (custom[prop]) {
        if (prop === 'options') {
          this.options.options = this.options.options.concat(custom.options.options);
          this.options.parseOpts = this.options.parse();
          this.options.matrixOpts = this.options.matrix();
        } else {
          _.merge(this[prop], custom[prop]);
        }
      }
    });
  }

  public print() {
    // print General Configuration
    console.log(chalk.cyan('General Configuration:'));
    const generalProps: Array<keyof GeneralConfig> = Object.keys(this.general) as Array<keyof GeneralConfig>;
    generalProps.forEach((prop) => {
      console.log('\t-  ' + prop + ': ' + this.general[prop]);
    });

    console.log('');

    console.log(chalk.cyan('nfs Configuration:'));
    const nfsProps: Array<keyof NfsConfig> = Object.keys(this.storage.nfs) as Array<keyof NfsConfig>;
    nfsProps.forEach((prop) => {
      console.log('\t-  ' + prop + ': ' + this.storage.nfs[prop]);
    });
    console.log('');

    console.log(chalk.cyan('swift Configuration:'));
    const swiftProps: Array<keyof SwiftConfig> = Object.keys(this.storage.swift) as Array<keyof SwiftConfig>;
    swiftProps.forEach((prop) => {
      console.log('\t-  ' + prop + ': ' + this.storage.swift[prop]);
    });

    console.log('');

    console.log(chalk.cyan('K8S Configuration:'));
    const k8sProps: Array<keyof K8sConfig> = Object.keys(this.k8s) as Array<keyof K8sConfig>;
    k8sProps.forEach((prop) => {
      console.log('\t-  ' + prop + ': ' + this.k8s[prop]);
    });

    console.log(chalk.cyan('Test Plan:'));
    let i = 1;
    this.options.matrixOpts.forEach((plan) => {
      console.log('[plan ' + i + ']:');
      Object.keys(plan).forEach((key: string) => {
        console.log('\t-  ' + key + ': ' + plan[key]);
      });
      i = i + 1;
    });
    console.log('\n');
  }
}

export class StorageConfig {
    public nfs: NfsConfig = new NfsConfig();
    public swift: SwiftConfig = new SwiftConfig();
}

export class NfsConfig {
  public sshUser: string = 'stack';
  public sshIdentityFile: string = process.env.HOME + '/.ssh/bolt_id_rsa';
  public server: string = 'panda-3254280.slc07.dev.ebayc3.com';
  public root: string = '/nfs';
  public folder: string = '/default';

  constructor(sshUser?: string, sshIdentityFile?: string, server?: string, root?: string, folder?: string) {
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

export class SwiftConfig {
  public static key = {
    SWIFT_CONTAINER: 'pandaren_swift_container',
    SWIFT_PASSWORD: 'pandaren_swift_password',
    SWIFT_PROJECT: 'pandaren_swift_project',
    SWIFT_URL: 'pandaren_swift_url',
    SWIFT_USER: 'pandaren_swift_user',
  }
  public authUrl: string = 'https://keystone.ams1.cloud.ecg.so/v2.0';
  public projectName: string = 'bt-ci';
  public userName: string = 'bolt-cloud';
  public password: string = '';
  public container: string = 'automation';
  public objPath: string = 'temp';

  constructor(authUrl?: string, projectName?: string, userName?: string, pasword?: string, container?: string, objPath?: string) {
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

  public setObjectPath(path: string) {
    this.objPath = path;
  }
}

export class K8sConfig {
  public kubeConfigFile: string = process.env.HOME + '/.kube/config';
  public templatePath: string = __dirname + '/../../k8sTemplate';

  constructor(kubeConfigFile?: string, templatePath?: string) {
    if (kubeConfigFile) {
      this.kubeConfigFile = kubeConfigFile;
    }
    if (templatePath) {
      this.templatePath = templatePath;
    }
  }
}

export class GeneralConfig {
  public label: string = 'panda-' + randomWords({exactly: 2, join: '-', maxLength: 6});
  public storyFolder: string = process.cwd() + '/features';
  public storyName: string = '*';
  public dockerImage: string = 'dockerregistry-rsnpk.vip.slc07.dev.ebayc3.com:5000/bolt-bdd-cucumberjs:650741b0fb5348c6eadedc42ff293779189f14f9';
  public threadCount: number = 10;
  public timeout: number = 300;
  public retry: number = 0;
  public storage: string = 'nfs';
  public proxy: string = '';

  // tslint:disable-next-line:max-line-length
  constructor(label?: string, storyFolder?: string, storyName?: string, dockerImage?: string, threadCount?: number, retry?: number, storage?: string, proxy?: string) {
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

class Options {
  public allowUnknownOption: boolean = true;
  public supportedOptions: string[] = [
    'meta_label',
    'tags',
  ];
  public seperator: string = ',';
  public joiner: string = '\\+';

  public options: string[] = [
    'site=mx_vns,za',
    'tags="@{{site}} and @{{device}}"',
    'meta_label={{site}}_{{mobileName}}',
    'device+mobileName=desktop,mobile+iphone_6s',
  ];

  public parseOpts: any[] = this.parse();
  public matrixOpts: any[] = this.matrix();

  /*
  * key=value
  * to provide an array of value, e.g. site=mx_vns,za
  * to combine 2 key, key1[joiner]key2 e.g. device+mobileName=deskop,mobile+iphone6,mobile+samsung
  */
  constructor(options?: string[], supportedOptions?: string[], allowUnknownOption?:boolean, seperator?:string, joiner?:string) {
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

  public parse(): any[] {
    const parseOpts: any[] = [];
    this.options.forEach((optText) => {
      const keyvalueRegex = new RegExp('(.{1,}?)=(.*)');
      const matches = keyvalueRegex.exec(optText);
      const opts: any[] = [];
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
        } else {
          parseOpts.push(opt);
        }
      } else {
        console.log('[WARN] unrecognized option: ' + optText );
      }
    });
    return parseOpts;
  }

  public matrix(): any[] {
    let matrixOpts: any[] = [{}];
    optionLoop:
    this.parseOpts.forEach((parseOpt) => {
      const key: string = parseOpt.key;
      const values: string[] = parseOpt.value;
      const childOpts: any[] = [];
      values.forEach((value: string) => {
        // const opts:any[] = [];
        const joinRegex = new RegExp('([^' + this.joiner + ']{1,})' + this.joiner + '?(.*)');
        let remainKey = key;
        let remainValue = value;
        let keyJoinMatches = joinRegex.exec(remainKey);
        let valueJoinMatches = joinRegex.exec(remainValue);

        const opt: any = {};
        subKeyLoop:
        while (keyJoinMatches) {
          const subKey: string = keyJoinMatches[1];
          remainKey = keyJoinMatches[2];

          const subValue: string = valueJoinMatches ? valueJoinMatches[1] : '';
          remainValue = valueJoinMatches ? valueJoinMatches[2] : '';

          opt[subKey] = subValue;
          keyJoinMatches = joinRegex.exec(remainKey);
          valueJoinMatches = joinRegex.exec(remainValue);
        }
        childOpts.push(opt);
      });
      if (childOpts.length > 0) {
        const temp: object[] = [];
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
