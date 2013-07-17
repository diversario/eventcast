REPORTER = spec
TESTS = test/*

test:
	@NODE_ENV=test mocha --reporter $(REPORTER)

coverage:
	@$(MAKE) clean
	@mkdir reports
	@istanbul instrument --output lib-cov lib
	@ISTANBUL_REPORTERS=lcov COVERAGE_EVENTCAST=1 NODE_ENV=test mocha -R mocha-istanbul -t 20s $(TESTS)
	@mv lcov.info reports
	@mv lcov-report reports
	@rm -rf lib-cov
	@if [ -f "`which open`"  ] && [ "${TRAVIS}" != "true" ]; then open reports/lcov-report/index.html; fi

coveralls: test coverage
	@cat reports/lcov.info | ./node_modules/coveralls/bin/coveralls.js
	@$(MAKE) clean

clean:
	@rm -rf lib-cov reports

.PHONY: test test-cov coverage
