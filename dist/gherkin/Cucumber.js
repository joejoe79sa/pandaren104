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
const fs = __importStar(require("fs-extra"));
const config_1 = require("./../config/config");
const sh = __importStar(require("./../utils/shHelper"));
function searchStory(dir, storyList) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = [];
        storyList = storyList ? storyList : '';
        const regex = /\.feature/gi;
        storyList = storyList.replace(regex, '');
        const stories = storyList.split(',');
        for (const story of stories) {
            result = result.concat(yield sh.findAsync(dir, story, 'feature'));
        }
        result = result.filter((x, i) => {
            return result.indexOf(x) === i;
        });
        return result;
    });
}
exports.searchStory = searchStory;
function parseStory(path) {
    const gherkin = require('gherkin');
    const parser = new gherkin.Parser();
    const gherkinDoc = parser.parse(fs.readFileSync(path, 'utf8'));
    return gherkinDoc;
}
exports.parseStory = parseStory;
function filterStory(gherkinDoc, tags) {
    const gherkin = require('gherkin');
    const scenarios = new gherkin.Compiler().compile(gherkinDoc);
    const { default: tagParser } = require('cucumber-tag-expressions');
    const tagExpression = tagParser(JSON.parse(tags));
    for (const scenario of scenarios) {
        const scenarioTags = scenario.tags.map((tag) => {
            return tag.name;
        });
        const scenarioMatched = tagExpression.evaluate(scenarioTags);
        if (scenarioMatched) {
            return true;
        }
    }
    return false;
}
exports.filterStory = filterStory;
function collectResult(gherkinDoc, uri, label, commands, resultFolder, exception, message) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = [];
        let status = Status.NOT_PERFORMED;
        if (resultFolder && !exception) {
            fs.readdirSync(resultFolder).forEach((file) => {
                const path = resultFolder + '/' + file;
                if ((!fs.lstatSync(path).isFile()) || (file === 'dumb.json')) {
                    return;
                }
                try {
                    result = result.concat(parseJsonResult(path, uri, commands));
                }
                catch (err) {
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
            result = [suite];
            return Promise.resolve({ results: result, status: status });
        }
        if (result.length === 0) {
            const suiteDoc = gherkinDoc.feature;
            const test = new Test(label, commands, message);
            const suite = new Suite(suiteDoc.name, uri, suiteDoc.keyword, suiteDoc.description);
            suite.addTest(test);
            result = [suite];
        }
        return Promise.resolve({ results: result, status: status });
    });
}
exports.collectResult = collectResult;
function parseJsonResult(file, uri, commands) {
    const suitesJson = JSON.parse(fs.readFileSync(file, 'utf8'));
    const suites = [];
    suitesJson.forEach((suiteJson) => {
        if (!suiteJson.elements) {
            return;
        }
        const suite = new Suite(suiteJson.name, uri, suiteJson.keyword, suiteJson.description);
        const test = new Test(suiteJson.metadata.pandaren.label, commands);
        const run = new Run();
        suiteJson.elements.forEach((scenarioJson) => {
            const tags = scenarioJson.tags.map((tag) => {
                return tag.name;
            });
            const scenario = new Scenario(scenarioJson.name, scenarioJson.keyword, tags);
            const performable = new Performable();
            scenarioJson.steps.forEach((stepJson) => {
                const step = new Step(stepJson.name, stepJson.keyword, stepJson.result.status, stepJson.result.error_message, stepJson.embeddings, stepJson.hidden);
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
function generateReport(result, outputFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        fs.emptyDirSync(outputFolder);
        fs.copySync(__dirname + '/../../report', outputFolder);
        const fd = fs.openSync(outputFolder + '/js/data.js', 'a+');
        const buf = Buffer.from('var data = ' + JSON.stringify(result));
        fs.writeSync(fd, buf, 0, buf.length, 0);
        fs.close(fd);
        console.log('[INFO][REPORT] report is saved ' + outputFolder + '/index.html');
        return;
    });
}
exports.generateReport = generateReport;
class Result {
    constructor(suites, config) {
        this.pass = 0;
        this.fail = 0;
        this.skip = 0;
        this.total = 0;
        this.config = new config_1.GeneralConfig();
        this.pass_suites = [];
        this.fail_suites = [];
        this.skip_suites = [];
        this.suites = [];
        this.suites = suites;
        this.total = suites.length;
        this.config = config;
        this.summarize();
    }
    add(newSuite) {
        const suiteExist = this.suites.filter((x) => {
            return x.name === newSuite.name;
        });
        if (suiteExist.length > 0) {
            newSuite.tests.forEach((test) => {
                suiteExist[0].addTest(test);
            });
        }
        else {
            this.suites.push(newSuite);
        }
        this.summarize();
    }
    summarize() {
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
exports.Result = Result;
var Status;
(function (Status) {
    Status["SUCCESSFUL"] = "SUCCESSFUL";
    Status["FAILED"] = "FAILED";
    Status["NOT_PERFORMED"] = "NOT_PERFORMED";
})(Status = exports.Status || (exports.Status = {}));
function statusCompare(a, b) {
    if (a === b) {
        return 0;
    }
    else if ((a === Status.FAILED) || ((a === Status.SUCCESSFUL) && (b === Status.NOT_PERFORMED))) {
        return -1;
    }
    return 1;
}
function updateStatus(now, before) {
    let after = before;
    if (before === Status.NOT_PERFORMED || now === Status.FAILED) {
        after = now;
    }
    return after;
}
exports.updateStatus = updateStatus;
function summarizeStatus(units) {
    const performed = units.filter((unit) => {
        return unit.status !== Status.NOT_PERFORMED;
    });
    const passed = units.filter((unit) => {
        return unit.status === Status.SUCCESSFUL;
    });
    if (performed.length === 0) {
        return Status.NOT_PERFORMED;
    }
    else if (passed.length === performed.length) {
        return Status.SUCCESSFUL;
    }
    return Status.FAILED;
}
exports.summarizeStatus = summarizeStatus;
class Suite {
    constructor(name, uri, keyword, desc) {
        this.name = 'Here is name for suite';
        this.uri = '';
        this.keyword = 'Feature';
        this.desc = 'Here is description for suite';
        this.status = Status.NOT_PERFORMED;
        this.tests = [];
        this.commands = [];
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
                    this.desc = this.desc + '<tr><td>' + key + '</td><td>' + metadata[key] + '</td></tr>';
                });
                this.desc = this.desc + '</table> ';
            }
            catch (e) {
                this.desc = desc;
            }
        }
    }
    addTest(newTest) {
        const testExist = this.tests.filter((x) => {
            return x.label === newTest.label;
        });
        if (testExist.length > 0) {
            newTest.run.forEach((run) => {
                testExist[0].addRun(run);
            });
        }
        else {
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
exports.Suite = Suite;
class Test {
    constructor(label, commands, message) {
        this.label = 'default';
        this.commands = [];
        this.message = '';
        this.status = Status.NOT_PERFORMED;
        this.run = [];
        this.retry = 0;
        this.label = label;
        if (commands) {
            this.commands = commands;
        }
        if (message) {
            this.message = message;
        }
    }
    addRun(newRun) {
        this.run.push(newRun);
        this.retry = this.run.length - 1;
        this.status = newRun.status;
    }
}
exports.Test = Test;
class Run {
    constructor(exception) {
        this.status = Status.NOT_PERFORMED;
        this.scenarios = [];
        this.exception = '';
        if (exception) {
            this.exception = exception;
            this.status = Status.FAILED;
        }
    }
    addScenario(newScenario) {
        this.scenarios.push(newScenario);
        this.status = updateStatus(newScenario.status, this.status);
    }
}
exports.Run = Run;
class Scenario {
    constructor(name, keyword, tags) {
        this.name = 'here is scenario name';
        this.keyword = 'Scenario';
        this.tags = [];
        this.status = Status.NOT_PERFORMED;
        this.performables = [];
        this.name = name;
        this.keyword = keyword;
        this.tags = tags;
    }
    addPerformable(newPerformable) {
        this.performables.push(newPerformable);
        this.status = updateStatus(newPerformable.status, this.status);
    }
}
exports.Scenario = Scenario;
class Performable {
    constructor() {
        this.steps = [];
        this.status = Status.NOT_PERFORMED;
    }
    addStep(newStep) {
        this.steps.push(newStep);
        this.status = updateStatus(newStep.status, this.status);
    }
}
exports.Performable = Performable;
class Step {
    constructor(name, keyword, statusText, message, embeddings, hidden) {
        this.name = '';
        this.status = Status.NOT_PERFORMED;
        this.messages = [];
        this.hidden = false;
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
        this.name = name ? keyword + ' ' + name + ' (' + statusText + ')' : keyword;
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
                        this.messages.push('<img class=\"screenshot\" src=\"' + imgSrc + '\">');
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
exports.Step = Step;
