in_memory_mq_test:
	 expresso -I mqs test/in_memory_mq_test.js

subscription_manager_test:
	 expresso -I mqs test/subscription_manager_test.js

uuid_test:
	 expresso -I lib test/uuid_test.js

push_it_server_test:
	 expresso -I lib -I mqs -I etc -I models test/push_it_server_test.js

expresso:
	expresso -I lib -I mqs -I etc -I models .

all:	in_memory_mq_test subscription_manager_test uuid_test push_it_server_test expresso
