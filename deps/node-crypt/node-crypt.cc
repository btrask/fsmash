/* Copyright (c) 2010, Ben Trask
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * The names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY BEN TRASK ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL BEN TRASK BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
#include <node.h>
#include <v8.h>

extern "C" {
#include "crypt_blowfish-1.0.4/ow-crypt.h"
}

using namespace v8;

Handle<Value> BTCrypt(const Arguments& args) {
	HandleScope scope;
	if(2 != args.Length()) return ThrowException(Exception::Error(String::New("Expected args key, setting")));
	if(!args[0]->IsString()) return ThrowException(Exception::Error(String::New("Arg key is not a string")));
	if(!args[1]->IsString()) return ThrowException(Exception::Error(String::New("Arg setting is not a string")));
	String::Utf8Value key(args[0]->ToString());
	String::Utf8Value setting(args[1]->ToString());
	char *const result = crypt(*key, *setting);
	return scope.Close(result ? String::New(result) : Null());
}
Handle<Value> BTGensalt(const Arguments& args) {
	HandleScope scope;
	if(3 != args.Length()) return ThrowException(Exception::Error(String::New("Expected args prefix, count, input")));
	if(!args[0]->IsString()) return ThrowException(Exception::Error(String::New("Arg prefix is not a string")));
	if(!args[1]->IsInt32()) return ThrowException(Exception::Error(String::New("Arg count is not a integer")));
	if(!args[2]->IsString()) return ThrowException(Exception::Error(String::New("Arg input is not a string")));
	String::Utf8Value prefix(args[0]->ToString());
	uint32_t const count = args[1]->Uint32Value();
	Local<String> inputStr = args[2]->ToString();
	String::Utf8Value input(inputStr);
	int const length = inputStr->Length();
	char *const result = crypt_gensalt(*prefix, count, *input, length);
	return scope.Close(result ? String::New(result) : Null());
}

void BTInitialize(Handle<Object> target) 
{
	target->Set(String::NewSymbol("crypt"), FunctionTemplate::New(BTCrypt)->GetFunction());
	target->Set(String::NewSymbol("gensalt"), FunctionTemplate::New(BTGensalt)->GetFunction());
	target->Set(String::NewSymbol("BLOWFISH"), String::New("$2a$"));
	target->Set(String::NewSymbol("MD5"), String::New("$1$"));
	target->Set(String::NewSymbol("EXTENDED"), String::New("_"));
}
NODE_MODULE(crypt, BTInitialize)
