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
const sh = __importStar(require("./../utils/shHelper"));
function searchStory(dir, storyList) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = [];
        storyList = storyList ? storyList : '';
        const regex = /\.story/gi;
        storyList = storyList.replace(regex, '');
        const stories = storyList.split(',');
        for (const story of stories) {
            result = result.concat(yield sh.findAsync(dir, story, 'story'));
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
