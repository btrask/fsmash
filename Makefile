CLIENT_SCRIPTS = client/external/json2.js \
                 client/external/cookie.js \
                 shared/bt.js \
                 shared/brawl.js \
                 client/utilities/DOM.js \
                 client/utilities/youtube.js \
                 client/classes/SidebarItem.js \
                 client/classes/AboutPage.js \
                 client/classes/VideosPage.js \
                 client/classes/Session.js \
                 client/classes/User.js \
                 client/classes/Administrator.js \
                 client/classes/Person.js \
                 client/classes/Group.js \
                 client/classes/Channel.js \
                 client/classes/Game.js \
                 client/client.js

STYLE_BASE_COMPONENTS = global.css sidebar.css modal.css authenticate.css account.css channel.css static.css videos.css administrator.css subscribe.css
STYLES += public/styles/base/index.css public/styles/base/resources
STYLES += public/styles/dark/index.css public/styles/dark/resources
STYLES += public/styles/greenscreen/index.css
STYLES += public/styles/splatoon/index.css public/styles/splatoon/resources

all: gzip

clean:
	-rm -rf public

public: public/robots.txt public/favicon.ico public/thumbnail.gif public/index.html public/compiled.js public/soundsets $(STYLES)

public/compiled.js: $(CLIENT_SCRIPTS)
	-mkdir -p $(dir $@)
	java -jar deps/compiler-latest/compiler.jar $(addprefix --js=,$+) --js_output_file=$@ --language_in=ECMASCRIPT5 #--compilation_level WHITESPACE_ONLY --formatting PRETTY_PRINT

public/styles/base/index.css: $(addprefix client/styles/base/,$(STYLE_BASE_COMPONENTS))
	-mkdir -p $(dir $@)
	cat $+ | java -jar deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

public/styles/%/index.css: client/styles/%/index.css
	-mkdir -p $(dir $@)
	cat $+ | java -jar deps/yuicompressor-2.4.2/build/yuicompressor-2.4.2.jar --type css --charset utf-8 -o $@

public/%: client/%
	-mkdir -p $(dir $@)
	cp -R $< $@

gzip: public
	for F in `find public -type f ! -name '*.gz' ! -name '*.wav' ! -name '.*'`; do gzip -nc9 $$F > $$F.gz; done

release: gzip
	for F in `find public -type f ! -name '*.gz' ! -name '*.wav' ! -name '.*'`; do rm $$F; done

.PHONY: all clean gzip release
