BACKEND := backend

.PHONY: run test cover fuzz lint

## run: start the API on :8080
run:
	cd $(BACKEND) && go run ./cmd/server

## test: run all backend tests with the race detector and print coverage per package
##       (make test V=1 lists every individual test)
test:
	cd $(BACKEND) && go test -race -cover $(if $(V),-v) ./...

## cover: write backend/coverage.out and backend/coverage.html, print per-function coverage
cover:
	cd $(BACKEND) && go test -coverprofile=coverage.out ./internal/... \
		&& go tool cover -func=coverage.out \
		&& go tool cover -html=coverage.out -o coverage.html

## fuzz: fuzz the expression evaluator for 30s
fuzz:
	cd $(BACKEND) && go test -fuzz=FuzzEvaluate -fuzztime=30s ./internal/calc

## lint: gofmt and go vet
lint:
	cd $(BACKEND) && test -z "$$(gofmt -l .)" && go vet ./...
