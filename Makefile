TESTS=test/*
REPORTER=spec

test:
	@COVERAGE= NODE_ENV=test mocha \
		--reporter $(REPORTER) \
		--timeout 28s \
		--growl \
		--bail \
		$(TESTS)

test-watch:
	@NODE_ENV=test mocha \
		--reporter $(REPORTER) \
		--timeout 0 \
		--growl \
		--watch \
		$(TESTS)

test-coverage: lib-coverage
	@mkdir -p build/coverage
	@COVERAGE=1 $(MAKE) test REPORTER=html-cov > build/coverage/index.html

lib-coverage:
	@rm -rf lib-cov
	@jscoverage lib lib-cov

docs:
	@mkdir -p build/api
	@yuidoc

clean:
	@rm -rf lib-cov build reports .sonar

.PHONY: test test-watch

xunit:
	@# check if reports folder exists, if not create it
	@test -d reports || mkdir reports
	@NODE_ENV=test XUNIT_FILE="reports/TESTS-xunit.xml" mocha -R xunit-file -t 20s $(TESTS)
	
coverage:
	@# check if reports folder exists, if not create it
	@test -d reports || mkdir reports
	@istanbul instrument --output lib-cov lib
	@# move original src code and replace it by the instrumented one
	@mv lib lib-orig && mv lib-cov lib
	@# tell istanbul to only generate the lcov file
	ISTANBUL_REPORTERS=lcovonly NODE_ENV=test mocha -R mocha-istanbul -t 20s $(TESTS)
	@# place the lcov report in the report folder, remove instrumented code
	@# and reput src at its place
	@mv lcov.info reports/coverage.lcov
	@rm -rf lib
	@mv lib-orig lib

sonar:
	sonar-runner
	@rm -rf .sonar
