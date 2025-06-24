all: ft_transcendence

ft_transcendence:
				@docker compose up --build || test $$? -eq 130

# Stop and remove containers, volume, and orphans
clean:
	docker-compose down --volumes --remove-orphans

#full clean containers, images, volumes, networks, cache
fclean:
	docker-compose down --rmi all --volumes --remove-orphans
	docker system prune -a -f --volumes

re:
	$(MAKE) fclean
	$(MAKE) all

.PHONY: all ft_transcendence clean fclean re