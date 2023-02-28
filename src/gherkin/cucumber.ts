'use strict';

import * as fs from 'fs-extra';
import { GeneralConfig } from './../config/config';
import * as sh from './../utils/shHelper';

export async function searchStory(dir: string, storyList?: string) {
  let result: any[] = [];
  storyList = storyList ? storyList : '';
  const regex: RegExp = /\.feature/gi;
  storyList = storyList.replace(regex, '');
  const stories = storyList.split(',');

  for (const story of stories) {
    result = result.concat(await sh.findAsync(dir, story, 'feature'));
  }

  // remove duplicate
  result = result.filter((x, i) => {
    return result.indexOf(x) === i;
  });

  return result;
}

export function parseStory(path: string) {
  const gherkin = require('gherkin');
  const parser = new gherkin.Parser();
  const gherkinDoc = parser.parse(fs.readFileSync(path, 'utf8'));
  return gherkinDoc;
}

export function filterStory(gherkinDoc: any, tags: string): boolean {
  const gherkin = require('gherkin');
  const scenarios = new gherkin.Compiler().compile(gherkinDoc);
  const {default: tagParser} = require('cucumber-tag-expressions');
  const tagExpression = tagParser(JSON.parse(tags));
  for (const scenario of scenarios) {
    const scenarioTags = scenario.tags.map((tag: any) => {
      return tag.name;
     });
    const scenarioMatched = tagExpression.evaluate(scenarioTags);
    if (scenarioMatched) {
      return true;
    }
  }
  return false;
}

export async function collectResult(gherkinDoc: any, uri: string, label: string, commands?: string[], resultFolder?: string, exception?: string, message?: string) {
  let result: Suite[] = [];
  let status: Status = Status.NOT_PERFORMED;

  if (resultFolder && !exception) {
    fs.readdirSync(resultFolder).forEach((file: string) => {
      const path = resultFolder + '/' + file;
      if ((! fs.lstatSync(path).isFile()) || (file === 'dumb.json')) {
        return;
      }
      try {
        result = result.concat(parseJsonResult(path, uri, commands));
      } catch (err) {
        console.log('[ERROR] Failed to parse json result (', path, ')');
        exception = err;
      }
    });
    result.forEach((suiteResult) => {
      status = updateStatus(suiteResult.status, status);
    });
    fs.copySync(resultFolder, 'archive');
  }

  if (exception) {
    const suiteDoc = gherkinDoc.feature;
    const run = new Run(exception);
    const test = new Test(label, commands);
    test.addRun(run);
    const suite = new Suite(suiteDoc.name, uri, suiteDoc.keyword, suiteDoc.description);
    suite.addTest(test);
    status = Status.FAILED;
    result = [ suite ];
    return Promise.resolve({results: result, status: status});
  }

  if (result.length === 0) {
    const suiteDoc = gherkinDoc.feature;
    const test = new Test(label, commands, message);
    const suite = new Suite(suiteDoc.name, uri, suiteDoc.keyword, suiteDoc.description);
    suite.addTest(test);
    result = [ suite ];
  }
  return Promise.resolve({results: result, status: status});
}

function parseJsonResult(file: string, uri: string, commands?: string[]): Suite[] {
  const suitesJson: any[] = JSON.parse(fs.readFileSync(file, 'utf8'));
  const suites: Suite[] = [];
  suitesJson.forEach((suiteJson) => {
    if (!suiteJson.elements) {
        return;
    }
    const suite = new Suite(suiteJson.name, uri, suiteJson.keyword, suiteJson.description);
    const test = new Test(suiteJson.metadata.pandaren.label, commands);
    const run = new Run();
    suiteJson.elements.forEach((scenarioJson: any) => {
      const tags: string[] = scenarioJson.tags.map((tag: any) => {
        return tag.name;
      });
      const scenario = new Scenario(scenarioJson.name, scenarioJson.keyword, tags);
      const performable = new Performable();
      scenarioJson.steps.forEach((stepJson: any) => {
        const step = new Step(
          stepJson.name,
          stepJson.keyword,
          stepJson.result.status,
          stepJson.result.error_message,
          stepJson.embeddings,
          stepJson.hidden,
        );
        performable.addStep(step);
      });
      scenario.addPerformable(performable);
      run.addScenario(scenario);
    });
    test.addRun(run);
    suite.addTest(test);
    suites.push(suite);
  });
  return suites;
}

export async function generateReport(result: Result, outputFolder: string) {
  fs.emptyDirSync(outputFolder);
  fs.copySync(__dirname + '/../../report', outputFolder);
  const fd = fs.openSync(outputFolder + '/js/data.js', 'a+');
  const buf = Buffer.from('var data = ' + JSON.stringify(result));
  fs.writeSync(fd, buf, 0, buf.length, 0);
  fs.close(fd);
  console.log('[INFO][REPORT] report is saved ' + outputFolder + '/index.html');
  return;
}

export class Result {
  public pass: number = 0;
  public fail: number = 0;
  public skip: number = 0;
  public total: number = 0;
  public config: GeneralConfig = new GeneralConfig();
  public pass_suites: Suite[] = [];
  public fail_suites: Suite[] = [];
  public skip_suites: Suite[] = [];
  public suites: Suite[] = [];

  constructor(suites: Suite[], config: GeneralConfig) {
    this.suites = suites;
    this.total = suites.length;
    this.config = config;
    this.summarize();
  }

  public add(newSuite: Suite) {
    const suiteExist = this.suites.filter((x) => {
      return x.name === newSuite.name;
    });
    if (suiteExist.length > 0) {
      newSuite.tests.forEach((test) => {
        suiteExist[0].addTest(test);
      });
    } else {
      this.suites.push(newSuite);
    }
    this.summarize();
  }

  public summarize() {
      this.pass_suites = this.suites.filter((suite) => {
        return suite.status === Status.SUCCESSFUL;
      });
      this.skip_suites = this.suites.filter((suite) => {
        return suite.status === Status.NOT_PERFORMED;
      });
      this.fail_suites = this.suites.filter((suite) => {
        return suite.status === Status.FAILED;
      });
      this.pass = this.pass_suites.length;
      this.skip = this.skip_suites.length;
      this.fail = this.fail_suites.length;
      this.total = this.suites.length;
      console.log('pass:' + this.pass + ', fail:' + this.fail);
  }
}

export enum Status {
  SUCCESSFUL = "SUCCESSFUL",
  FAILED = "FAILED",
  NOT_PERFORMED = "NOT_PERFORMED",
}

function statusCompare(a: Status, b: Status): number {
  if (a === b) {
    return 0;
  } else if ((a === Status.FAILED) || ((a === Status.SUCCESSFUL) && (b === Status.NOT_PERFORMED))) {
    return -1;
  }
  return 1;
}

export function updateStatus(now: Status, before: Status): Status {
  let after: Status = before;
  if (before === Status.NOT_PERFORMED || now === Status.FAILED ) {
    after = now;
  }
  return after;
}

export function summarizeStatus(units: any[]): Status {
  const performed = units.filter( (unit) => {
    return unit.status !== Status.NOT_PERFORMED;
  });
  const passed = units.filter( (unit) => {
    return unit.status === Status.SUCCESSFUL;
  });
  if (performed.length === 0) {
    return Status.NOT_PERFORMED;
  } else if (passed.length === performed.length) {
    return Status.SUCCESSFUL;
  }
  return Status.FAILED;
}

export class Suite {
    public name: string = 'Here is name for suite';
    public uri: string = '';
    public keyword: string = 'Feature';
    public desc: string = 'Here is description for suite';
    public status: Status = Status.NOT_PERFORMED;
    public tests: Test[] = [];
    public commands: string[] = [];

    constructor(name: string, uri: string, keyword?: string, desc?: string) {
      this.name = name;
      this.uri = uri;
      if (keyword) {
        this.keyword = keyword;
      }
      if (desc) {
        try {
          const metadata = JSON.parse(desc).metadata;
          this.desc = '<table class=\"table-condensed table-striped\" style=\"font-size: 0.95em\">';
          Object.keys(metadata).forEach((key) => {
            if (key === 'author' && metadata[key] === 'N.N.') {
              metadata[key] = '<img style=\"height:1.8em; margin-bottom:0.5em\" src=\"images/duck.png\""> '
              + metadata[key];
            }
            this.desc = this.desc  + '<tr><td>' + key + '</td><td>' + metadata[key] + '</td></tr>';
            });
          this.desc = this.desc + '</table> ';
        } catch (e) {
          this.desc = desc;
        }
      }
    }
    public addTest(newTest: Test) {
      const testExist = this.tests.filter((x) => {
        return x.label === newTest.label;
      });
      if (testExist.length > 0) {
        newTest.run.forEach((run) => {
          testExist[0].addRun(run);
        });
      } else {
        this.tests.push(newTest);
      }
      this.tests.sort((a, b) => {
        const statusA = a.status;
        const statusB = b.status;
        return statusCompare(statusA, statusB);
      });
      this.status = summarizeStatus(this.tests);
    }
}

export class Test {
  public label: string = 'default';
  public commands: string[] = [];
  public message: string = '';
  public status: Status = Status.NOT_PERFORMED;
  public run: Run[] = [];
  public retry: number = 0;

  constructor(label: string, commands?: string[], message?: string) {
    this.label = label;
    if (commands) {
      this.commands = commands;
    }
    if (message) {
      this.message = message;
    }
  }

  public addRun(newRun: Run) {
    this.run.push(newRun);
    this.retry = this.run.length - 1;
    this.status = newRun.status;
  }
}

export class Run {
  public status: Status = Status.NOT_PERFORMED;
  public scenarios: Scenario[] = [];
  public exception: string = '';

  constructor(exception?: string) {
    if (exception) {
      this.exception = exception;
      this.status = Status.FAILED;
    }
  }
  public addScenario(newScenario: Scenario) {
    this.scenarios.push(newScenario);
    this.status = updateStatus(newScenario.status, this.status);
  }
}

export class Scenario {
  public name: string = 'here is scenario name';
  public keyword: string = 'Scenario';
  public tags: string[] = [];
  public status: Status = Status.NOT_PERFORMED;
  public performables: Performable[] = [];

  constructor(name: string, keyword: string, tags: string[]) {
    this.name = name;
    this.keyword = keyword;
    this.tags = tags;
  }
  public addPerformable(newPerformable: Performable) {
    this.performables.push(newPerformable);
    this.status = updateStatus(newPerformable.status, this.status);
  }
}

export class Performable {
  public steps: Step[] = [];
  public status: Status = Status.NOT_PERFORMED;

  public addStep(newStep: Step) {
    this.steps.push(newStep);
    this.status = updateStatus(newStep.status, this.status);
  }
}

export class Step {
  public name: string = '';
  public status: Status = Status.NOT_PERFORMED;
  public messages: string[] = [];
  public hidden: boolean = false;

  constructor(
    name: string,
    keyword: string,
    statusText: string,
    message: string,
    embeddings: any[],
    hidden: boolean,
  ) {
    switch (statusText) {
      case "passed":
        this.status = Status.SUCCESSFUL;
        break;
      case "failed":
      case "undefined":
      case "pending":
      case "ambiguous":
        this.status = Status.FAILED;
        break;
      case "skipped":
        this.status = Status.NOT_PERFORMED;
    }

    this.name =  name ? keyword + ' ' + name + ' (' + statusText + ')' : keyword;
    if (message) {
      this.messages.push(message);
    }
    if (embeddings) {
        embeddings.forEach((embedding) => {
            switch (embedding.mime_type) {
              case 'text/html':
                if (embedding.data.includes('screenshot')) {
                  const regex = new RegExp('[^/]*\.png');
                  const match = regex.exec(embedding.data);
                  if (match) {
                    const image = match[0];
                    this.messages.push('<img class=\"screenshot\" src=\"../screenshot/' + image + '\">');
                  }
                }
                break;
              case 'image/png':
                const imgSrc = 'data:image/png;base64,' + embedding.data;
                this.messages.push('<img class=\"screenshot\" src=\"' + imgSrc + '\">' );
                break;
              default:
                  this.messages.push(embedding.data);
            }
        });
    }
    if (this.messages.length > 0) {
        this.name = this.name + '  <a> + show info</a>';
    }
    this.hidden = hidden;
  }
}
