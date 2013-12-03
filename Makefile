APP_DIR = /home/abi/pic
SERVER_IP = 66.175.221.170

.PHONY : default
default: tunnel
	DEBUG="*,-connect:*,-express:*,-send" ./node_modules/.bin/nodemon .

.PHONY : update-deps
update-deps:
	npm prune
	npm install
	./node_modules/.bin/bower install

.PHONY : tunnel
tunnel:
	ssh -L 27017:localhost:27017 -N abi@$(SERVER_IP) -p 33333 &

.PHONY : test
test:
	DEBUG="*,-connect:*,-express:*,-send,-mocha:*" ./node_modules/.bin/mocha test/api.js --timeout 5000

.PHONY : rebuild
rebuild:
	npm rebuild

.PHONY : deploy
deploy:
	ssh -t abi@$(SERVER_IP) -p 33333 'cd $(APP_DIR) && git pull && sudo supervisorctl reload && sleep 3 && sudo supervisorctl restart all'