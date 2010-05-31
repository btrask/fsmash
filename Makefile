CLIENT_SCRIPTS = client/external/json2.js \
                 client/external/cookie.js \
                 shared/bt.js \
                 shared/brawl.js \
                 client/utilities/DOM.js \
                 client/utilities/youtube.js \
                 client/classes/SidebarItem.js \
                 client/classes/Session.js \
                 client/classes/User.js \
                 client/classes/Admin.js \
                 client/classes/Person.js \
                 client/classes/Group.js \
                 client/classes/Channel.js \
                 client/classes/Game.js \
                 client/client.js

STYLE_BASE_COMPONENTS = global.css sidebar.css modal.css authenticate.css account.css channel.css about.css videos.css
STYLES += public/styles/base/index.css public/styles/base/resources
STYLES += public/styles/dark/index.css public/styles/dark/resources
STYLES += public/styles/greenscreen/index.css

all: gzip

clean:
	-rm -rf public

public: public/robots.txt public/favicon.ico public/index.html public/compiled.js public/soundsets $(STYLES)

public/compiled.js: $(CLIENT_SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar deps/compiler-latest/compiler.jar $(addprefix --js=,$+) --js_output_file=$@

public/styles/base/index.css: $(addprefix client/styles/base/,$(STYLE_BASE_COMPONENTS))
	-mkdir -p $(dir $@)
	cat $+ | java -jar deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css -o $@

public/styles/dark/index.css: client/styles/dark/index.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css -o $@

public/%: client/%
	-mkdir -p $(dir $@)
	cp -R $< $@

gzip: public
	for F in `find public -type f ! -name '*.gz' ! -name '.*'`; do gzip -nc9 $$F > $$F.gz; done

gzip-only: gzip
	for F in `find public -type f ! -name '*.gz' ! -name '.*'`; do rm $$F; done

.PHONY: all clean gzip
