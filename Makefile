all:check-docker ssl-setup ft_transcendence

check-docker:
			@docker ps > /dev/null 2>&1 || ( \
				echo "🔍 Docker is not running. Starting Docker Desktop..."; \
				open -a Docker && \
				printf "⏳ Waiting for Docker to start"; \
				while ! docker ps > /dev/null 2>&1; do \
					printf "."; \
					sleep 1; \
				done; \
				echo "\n✅ Docker started successfully!"; \
			)

ssl-setup:
	@echo "🔐 Setting up SSL certificates..."
	@bash ./ssl-setup.sh

ft_transcendence:
				@echo "🚀 Starting ft_transcendence containers..."
				@docker compose up --build || test $$? -eq 130

# Stop and remove containers, volume, and orphans
clean:
	@echo "🧹 Cleaning containers and volumes..."
	@docker-compose down --volumes --remove-orphans

#full clean containers, images, volumes, networks, cache
fclean:
	@echo "🔥 Full clean: containers, images, volumes, and cache..."
	@docker-compose down --rmi all --volumes --remove-orphans
	@docker image prune -af

re:
	$(MAKE) fclean
	$(MAKE) all

.PHONY: all ft_transcendence clean fclean re