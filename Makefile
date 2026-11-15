BACKEND  := backend
FRONTEND := frontend

# Use the Node version pinned in frontend/.nvmrc when nvm is installed;
# otherwise the Node on PATH is used.
NODE := if [ -s "$$HOME/.nvm/nvm.sh" ]; then . "$$HOME/.nvm/nvm.sh" >/dev/null && nvm use --silent >/dev/null 2>&1; fi;

.PHONY: install dev run web test test-backend test-frontend cover fuzz lint build

## install: install frontend dependencies (Go fetches its own on first build)
install:
	cd $(FRONTEND) && $(NODE) npm ci

## dev: API on :8080 and frontend on :5173 together (Ctrl+C stops both)
dev:
	@(cd $(BACKEND) && go run ./cmd/server) & \
	(cd $(FRONTEND) && $(NODE) npm run dev); \
	wait

## run: API only, on :8080
run:
	cd $(BACKEND) && go run ./cmd/server

## web: frontend only, on :5173 (proxies /api to :8080)
web:
	cd $(FRONTEND) && $(NODE) npm run dev

## test: all backend and frontend tests (make test V=1 lists every Go test)
test: test-backend test-frontend

test-backend:
	cd $(BACKEND) && go test -race -cover $(if $(V),-v) ./...

test-frontend:
	cd $(FRONTEND) && $(NODE) npm test

## cover: coverage reports for both layers
##        backend/coverage.html and frontend/coverage/index.html
cover:
	cd $(BACKEND) && go test -coverprofile=coverage.out ./internal/... \
		&& go tool cover -func=coverage.out | tail -1 \
		&& go tool cover -html=coverage.out -o coverage.html
	cd $(FRONTEND) && $(NODE) npm run coverage

## fuzz: fuzz the expression evaluator for 30s
fuzz:
	cd $(BACKEND) && go test -fuzz=FuzzEvaluate -fuzztime=30s ./internal/calc

## lint: gofmt, go vet, oxlint, TypeScript
lint:
	cd $(BACKEND) && test -z "$$(gofmt -l .)" && go vet ./...
	cd $(FRONTEND) && $(NODE) npx oxlint && npx tsc -b

## build: production frontend bundle in frontend/dist
build:
	cd $(FRONTEND) && $(NODE) npm run build
