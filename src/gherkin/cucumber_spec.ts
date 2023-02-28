import { expect } from 'chai';
import * as cucumber from './cucumber';

describe('Cucumber Status', () => {
  describe('update status', () => {
    it('(success + failed) should return failed', () => {
      const result = cucumber.updateStatus(cucumber.Status.SUCCESSFUL, cucumber.Status.FAILED);
      expect(result).to.eq(cucumber.Status.FAILED);
    });
    it('(not_performed + failed) should return failed', () => {
      const result = cucumber.updateStatus(cucumber.Status.NOT_PERFORMED, cucumber.Status.FAILED);
      expect(result).to.eq(cucumber.Status.FAILED);
    });
    it('(success + not_performed) should return success', () => {
      const result = cucumber.updateStatus(cucumber.Status.SUCCESSFUL, cucumber.Status.NOT_PERFORMED);
      expect(result).to.eq(cucumber.Status.SUCCESSFUL);
    });
  });

  describe('summarize status', () => {
    const tests: any[] = [];
    for (let i = 0; i < 2; i++) {
      const test: cucumber.Test = new cucumber.Test(i.toString());
      test.status = cucumber.Status.SUCCESSFUL;
      tests.push(test);
    }
    it('all successful tests should return success', () => {
      expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.SUCCESSFUL);
    });
    it('if exist one not_performed test should return success', () => {
      const skipTest: cucumber.Test = new cucumber.Test('NOT_PERFORMED');
      tests.push(skipTest);
      expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.SUCCESSFUL);
    });
    it('if exist one failed test should return failed', () => {
      const failedTest: cucumber.Test = new cucumber.Test('FAILED');
      failedTest.status = cucumber.Status.FAILED;
      tests.push(failedTest);
      expect(cucumber.summarizeStatus(tests)).to.eq(cucumber.Status.FAILED);
    });
  });
});
