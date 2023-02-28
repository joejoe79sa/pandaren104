const app = angular.module('story_list', ['ngSanitize']);
app.controller('story_filter', function($scope) {
  $scope.result = data;
  $scope.result.history = 'hidden';
  $scope.result.show_detail_cb = 'hidden';
  $scope.fail=$scope.result.fail_suites;
  $scope.fail_stories = '';
  // $scope.fail.forEach(function(element) {
  //     $scope.fail_stories += element.suite_name + '.story,';
  // });
  $scope.fail_stories=$scope.fail_stories.slice(0, -1);
  $scope.pass=$scope.result.pass_suites;
  $scope.skip=$scope.result.skip_suites;
  $scope.total=$scope.fail;
  $scope.total=$scope.total.concat($scope.pass);
  $scope.total=$scope.total.concat($scope.skip);
  $scope.items=$scope.total;
  $scope.displayed_suite = $scope.items[0];
  $scope.displayed_suite.selected = 'selected';
  $scope.displayed_test = $scope.displayed_suite.tests[0];
  $scope.displayed_test.selected = 'selected';
  $scope.displayed_test.run_id = $scope.displayed_test.retry;
  $scope.loading = false;
  $scope.open_detail = function(item) {
    $scope.displayed_suite.selected = '';
    $scope.displayed_suite = item;
    $scope.displayed_suite.selected = 'selected';

    $scope.displayed_test.selected = '';
    $scope.displayed_test = $scope.displayed_suite.tests[0];
    $scope.displayed_test.selected = 'selected';
    $scope.displayed_test.run_id = $scope.displayed_test.retry;
  };
  $scope.open_test = function(test) {
    $scope.displayed_test.selected = '';
    $scope.displayed_test = test;
    $scope.displayed_test.selected = 'selected';
    $scope.displayed_test.run_id = $scope.displayed_test.retry;
  };
});
app.filter('trust2Html', ['$sce', function($sce) {
  return function(val) {
    return $sce.trustAsHtml(val);
  };
}]);
