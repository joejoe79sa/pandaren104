"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const cucumber = __importStar(require("./cucumber"));
describe('Cucumber Status', () => {
    describe('update status', () => {
        it('(success + failed) should return failed', () => {
            const result = cucumber.updateStatus(cucumber.Status.SUCCESSFUL, cucumber.Status.FAILED);
            chai_1.expect(result).to.eq(cucumber.Status.FAILED);
        });
        it('(not_performed + failed) should return failed', () => {
            const result = cucumber.updateStatus(cucumber.Status.NOT_PERFORMED, cucumber.Status.FAILED);
            chai_1.expect(result).to.eq(cucumber.Status.FAILED);
        });
        it('(success + not_performed) should return success', () => {
            const result = cucumber.updateStatus(cucumber.Status.SUCCESSFUL, cucumber.Status.NOT_PERFORMED);
            chai_1.expect(result).to.eq(cucumber.Status.SUCCESSFUL);
        });
    });
    describe('summarize status', () => {
        const tests = [];
        for (let i = 0; i < 2; i++) {
            const test = new cucumber.Test(i.toString());
            test.status = cucumber.Status.SUCCESSFUL;
            tests.push(test);
        }
        it('all successful tests should return success', () => {
            chai_1.expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.SUCCESSFUL);
        });
        it('if exist one not_performed test should return success', () => {
            const skipTest = new cucumber.Test('NOT_PERFORMED');
            tests.push(skipTest);
            chai_1.expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.SUCCESSFUL);
        });
        it('if exist one failed test should return failed', () => {
            const failedTest = new cucumber.Test('FAILED');
            failedTest.status = cucumber.Status.FAILED;
            tests.push(failedTest);
            chai_1.expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.FAILED);
        });
    });
});
