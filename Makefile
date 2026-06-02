.PHONY: up down build logs backend frontend db redis kafka clean

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

backend:
	cd backend && ./mvnw spring-boot:run

frontend:
	cd frontend && npm run dev

db:
	docker compose up -d postgres

redis:
	docker compose up -d redis

kafka:
	docker compose up -d zookeeper kafka kafka-init

clean:
	docker compose down -v
	rm -rf backend/target frontend/dist frontend/node_modules

reset-db:
	docker compose exec postgres psql -U velocity -d velocity -f /docker-entrypoint-initdb.d/01-init.sql
