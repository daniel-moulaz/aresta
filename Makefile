.PHONY: up down test test-api lint

up:
	docker compose up --build

down:
	docker compose down

test: lint test-api
	npm test

test-api:
	cd services/api && python3 -m pytest

lint:
	npm run lint
